import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    NotificationType,
    OrderStatus,
    PaymentMethod,
    Prisma,
    Role,
} from '@prisma/client';

import {
    isPrismaError,
    PRISMA_RECORD_NOT_FOUND,
} from 'src/common/database/prisma-errors';
import { isAdminRole } from 'src/common/auth/utils/roles';
import { DatabaseService } from 'src/common/database/services/database.service';
import { cursorArgs, toCursorPage } from 'src/common/helper/pagination';
import { toDecimal, toMoneyNumber } from 'src/common/helper/money';
import { formatUnitLabel } from 'src/common/helper/utils/unit-label';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { AuditService } from 'src/modules/audit/audit.service';
import { NotificationsService } from 'src/modules/notifications/notifications.service';

import {
    ORDER_MAX_TOTAL,
    OrderCreateDto,
} from './dtos/request/order.create.dto';
import { OrderQueryDto } from './dtos/request/order.query.dto';
import { OrderUpdateStatusDto } from './dtos/request/order.update-status.dto';
import {
    OrderListResponseDto,
    OrderResponseDto,
} from './dtos/response/order.response.dto';
import { OrdersGateway } from './orders.gateway';

const STATUS_LABEL: Record<OrderStatus, { en: string; ar: string }> = {
    [OrderStatus.PLACED]: { en: 'Order placed', ar: 'تم استلام طلبك' },
    [OrderStatus.CONFIRMED]: { en: 'Order confirmed', ar: 'تم تأكيد طلبك' },
    [OrderStatus.PREPARING]: {
        en: 'Preparing your order',
        ar: 'جارٍ تحضير طلبك',
    },
    [OrderStatus.READY]: { en: 'Order ready', ar: 'طلبك جاهز' },
    [OrderStatus.ON_THE_WAY]: { en: 'Order on the way', ar: 'طلبك في الطريق' },
    [OrderStatus.DELIVERED]: { en: 'Order delivered', ar: 'تم توصيل طلبك' },
    [OrderStatus.CANCELLED]: { en: 'Order cancelled', ar: 'تم إلغاء طلبك' },
};

/**
 * Order state machine (merchant/admin). Forward-only, one step at a time:
 * PLACED → CONFIRMED → PREPARING → READY → ON_THE_WAY → DELIVERED.
 * CANCELLED is reachable from every non-terminal state (i.e. before DELIVERED).
 */
export const ORDER_STATUS_TRANSITIONS: Record<
    OrderStatus,
    readonly OrderStatus[]
> = {
    [OrderStatus.PLACED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
    [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
    [OrderStatus.READY]: [OrderStatus.ON_THE_WAY, OrderStatus.CANCELLED],
    [OrderStatus.ON_THE_WAY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.CANCELLED]: [],
};

export function canTransitionOrder(
    from: OrderStatus,
    to: OrderStatus
): boolean {
    return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

const SHOP_SUMMARY_SELECT = {
    id: true,
    name: true,
    nameAr: true,
} satisfies Prisma.ShopSelect;

// Never select phone/email/passwordHash — merchants/admins only need these.
const RESIDENT_SUMMARY_SELECT = {
    id: true,
    name: true,
    unitNumber: true,
} satisfies Prisma.UserSelect;

type OrderRow = Prisma.OrderGetPayload<{
    include: {
        items: true;
        shop: { select: typeof SHOP_SUMMARY_SELECT };
    };
}> & {
    resident?: Prisma.UserGetPayload<{
        select: typeof RESIDENT_SUMMARY_SELECT;
    }>;
};

function orderInclude(actor: IAuthUser) {
    const includeResident =
        actor.role === Role.MERCHANT || isAdminRole(actor.role);
    return {
        items: true,
        shop: { select: SHOP_SUMMARY_SELECT },
        ...(includeResident
            ? { resident: { select: RESIDENT_SUMMARY_SELECT } }
            : {}),
    } satisfies Prisma.OrderInclude;
}

/**
 * Prisma row → API shape. Money leaves the service as plain numbers. Every
 * order response (REST, merchant module) goes through here.
 */
export function toOrderResponse(order: OrderRow): OrderResponseDto {
    const { items, resident, ...rest } = order;
    return {
        ...rest,
        totalAmount: toMoneyNumber(order.totalAmount),
        items: items.map(item => ({
            ...item,
            unitPrice: toMoneyNumber(item.unitPrice),
            lineTotal: toMoneyNumber(
                toDecimal(item.unitPrice).mul(item.quantity)
            ),
        })),
        // Merchants must see the flat the order goes to, not the resident's
        // primary flat. `resident.unitNumber` is kept (= deliveryUnit) because
        // old merchant builds read `resident?.unitNumber ?? deliveryUnit`.
        ...(resident
            ? { resident: { ...resident, unitNumber: order.deliveryUnit } }
            : {}),
    };
}

@Injectable()
export class OrdersService {
    /** Same rule as PaymentsService.ensureEnabled: flag on AND HMAC secret set. */
    private readonly paymentsEnabled: boolean;

    constructor(
        private readonly db: DatabaseService,
        private readonly gateway: OrdersGateway,
        private readonly notifications: NotificationsService,
        config: ConfigService,
        private readonly audit: AuditService
    ) {
        this.paymentsEnabled =
            config.get<boolean>('paymob.enabled') === true &&
            Boolean(config.get<string>('paymob.hmacSecret'));
    }

    async create(
        dto: OrderCreateDto,
        actor: IAuthUser
    ): Promise<OrderResponseDto> {
        // Card payments are off: refuse instead of creating an unpayable order.
        if (
            dto.paymentMethod === PaymentMethod.PAYMOB &&
            !this.paymentsEnabled
        ) {
            throw new ConflictException('order.error.paymentsDisabled');
        }

        const productIds = dto.items.map(i => i.productId);
        if (new Set(productIds).size !== productIds.length) {
            throw new BadRequestException('order.error.duplicateProducts');
        }

        // Fetch all products in one query
        const products = await this.db.product.findMany({
            where: {
                id: { in: productIds },
                isDeleted: false,
                isAvailable: true,
                // A soft-deleted shop cannot be ordered from.
                shop: { deletedAt: null },
            },
        });

        if (products.length !== productIds.length) {
            throw new BadRequestException(
                'order.error.someProductsUnavailable'
            );
        }

        // Validate all belong to the same shop
        const shopIds = [...new Set(products.map(p => p.shopId))];
        if (shopIds.length !== 1) {
            throw new BadRequestException(
                'order.error.multipleShopsNotAllowed'
            );
        }
        const shopId = shopIds[0]!;

        // Manual emergency override only — "open now" from workingHours is a
        // client-side presentation concern.
        const shop = await this.db.shop.findUnique({
            where: { id: shopId },
            select: { isOpen: true, deletedAt: true },
        });
        if (!shop || shop.deletedAt)
            throw new NotFoundException('shop.error.notFound');
        if (!shop.isOpen) {
            throw new ConflictException('order.error.shopClosed');
        }

        // Build item map for quantity lookup
        const productMap = new Map(products.map(p => [p.id, p]));

        // Compute total server-side in exact decimal arithmetic
        let totalAmount = new Prisma.Decimal(0);
        const orderItems = dto.items.map(item => {
            const product = productMap.get(item.productId)!;
            const unitPrice = toDecimal(product.price);
            totalAmount = totalAmount.add(unitPrice.mul(item.quantity));
            return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice,
                productNameSnapshot: product.name,
                productNameArSnapshot: product.nameAr,
            };
        });

        // Keeps the total inside the Decimal(10,2) column (a 400, never a
        // Prisma overflow) and blocks absurd orders.
        if (totalAmount.greaterThan(ORDER_MAX_TOTAL)) {
            throw new BadRequestException('order.error.totalTooLarge');
        }

        const deliveryUnit = await this.assertDeliveryUnit(
            actor.userId,
            dto.deliveryUnit
        );

        const order = await this.db.order.create({
            data: {
                residentId: actor.userId,
                shopId,
                totalAmount,
                notes: dto.notes,
                deliveryUnit,
                paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
                items: { create: orderItems },
            },
            include: orderInclude(actor),
        });

        return toOrderResponse(order);
    }

    /**
     * `deliveryUnit` (trimmed) must be one of the caller's flat labels or equal
     * to their `unitNumber` — always allowed: old mobile builds send exactly
     * it, and legacy accounts have a unitNumber but no flat rows. Otherwise
     * 400 `order.error.deliveryUnitInvalid`. Returns the trimmed value.
     */
    private async assertDeliveryUnit(
        userId: string,
        requested: string
    ): Promise<string> {
        const deliveryUnit = requested.trim();
        const user = await this.db.user.findUnique({
            where: { id: userId },
            select: {
                unitNumber: true,
                residentUnits: {
                    select: { building: true, floor: true, flatNumber: true },
                },
            },
        });
        const allowed = new Set<string>(
            (user?.residentUnits ?? []).map(formatUnitLabel)
        );
        if (user?.unitNumber) allowed.add(user.unitNumber.trim());
        if (!deliveryUnit || !allowed.has(deliveryUnit))
            throw new BadRequestException('order.error.deliveryUnitInvalid');
        return deliveryUnit;
    }

    async findAll(
        query: OrderQueryDto,
        actor: IAuthUser
    ): Promise<OrderListResponseDto> {
        const limit = query.limit ?? 20;

        // Build access-control where clause
        let where: Prisma.OrderWhereInput = {};
        if (actor.role === Role.RESIDENT) {
            where = { residentId: actor.userId };
        } else if (actor.role === Role.MERCHANT) {
            // Orders of the merchant's shops — a relation filter, so no
            // separate round-trip to list the shop ids first.
            where = { shop: { merchantId: actor.userId } };
        }
        // ADMIN: no restriction

        if (query.status) where.status = query.status;

        const rows = await this.db.order.findMany({
            where,
            take: limit + 1,
            ...cursorArgs(query.cursor),
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            include: orderInclude(actor),
        });

        const { items, nextCursor } = toCursorPage(rows, limit);

        return { items: items.map(toOrderResponse), nextCursor };
    }

    async findOne(id: string, actor: IAuthUser): Promise<OrderResponseDto> {
        const order = await this.db.order.findUnique({
            where: { id },
            include: orderInclude(actor),
        });

        if (!order) throw new NotFoundException('order.error.notFound');

        if (actor.role === Role.RESIDENT && order.residentId !== actor.userId) {
            throw new ForbiddenException('order.error.forbidden');
        }

        if (actor.role === Role.MERCHANT) {
            await this.assertMerchantOwnsShop(order.shopId, actor);
        }

        return toOrderResponse(order);
    }

    async updateStatus(
        id: string,
        dto: OrderUpdateStatusDto,
        actor: IAuthUser
    ): Promise<OrderResponseDto> {
        const order = await this.db.order.findUnique({
            where: { id },
            select: { id: true, shopId: true, status: true, isPaid: true },
        });
        if (!order) throw new NotFoundException('order.error.notFound');

        if (actor.role === Role.MERCHANT) {
            await this.assertMerchantOwnsShop(order.shopId, actor);
        }

        if (!canTransitionOrder(order.status, dto.status)) {
            throw new ConflictException('order.error.invalidStatusTransition');
        }

        const isCancel = dto.status === OrderStatus.CANCELLED;
        if (isCancel && order.isPaid) {
            throw new ConflictException('order.error.cannotCancelPaidOrder');
        }

        const updated = await this.guardedUpdate(
            id,
            order.status,
            {
                status: dto.status,
                ...(isCancel ? { cancelledAt: new Date() } : {}),
            },
            actor
        );

        // Emit real-time update to order room
        this.gateway.emitStatusUpdate(id, dto.status);

        // Push notification to resident
        const label = STATUS_LABEL[dto.status];
        this.notifications
            .send(
                updated.residentId,
                NotificationType.ORDER_UPDATE,
                label.en,
                label.ar,
                `Order #${id.slice(-6).toUpperCase()}`,
                `طلب #${id.slice(-6).toUpperCase()}`,
                { orderId: id, status: dto.status }
            )
            .catch(() => undefined); // fire-and-forget — never block status update

        await this.audit.record(actor, 'ORDER_STATUS_CHANGED', 'Order', id, {
            label: `Order #${id.slice(-6).toUpperCase()}`,
            status: dto.status,
        });

        return toOrderResponse(updated);
    }

    async cancel(id: string, actor: IAuthUser): Promise<OrderResponseDto> {
        const order = await this.db.order.findUnique({
            where: { id },
            select: {
                id: true,
                residentId: true,
                status: true,
                isPaid: true,
            },
        });

        if (!order) throw new NotFoundException('order.error.notFound');
        if (order.residentId !== actor.userId) {
            throw new ForbiddenException('order.error.forbidden');
        }
        if (order.status !== OrderStatus.PLACED) {
            throw new BadRequestException(
                'order.error.cannotCancelAfterConfirmation'
            );
        }
        if (order.isPaid) {
            throw new ConflictException('order.error.cannotCancelPaidOrder');
        }

        const updated = await this.guardedUpdate(
            id,
            OrderStatus.PLACED,
            { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
            actor
        );

        this.gateway.emitStatusUpdate(id, OrderStatus.CANCELLED);

        // Notify merchant about the cancellation
        const shop = await this.db.shop.findUnique({
            where: { id: updated.shopId },
            select: { merchantId: true },
        });
        if (shop) {
            this.notifications
                .send(
                    shop.merchantId,
                    NotificationType.ORDER_UPDATE,
                    'Order cancelled by resident',
                    'تم إلغاء الطلب من قِبَل الساكن',
                    `Order #${id.slice(-6).toUpperCase()} was cancelled`,
                    `الطلب #${id.slice(-6).toUpperCase()} تم إلغاؤه`,
                    { orderId: id, status: OrderStatus.CANCELLED }
                )
                .catch(() => undefined);
        }

        return toOrderResponse(updated);
    }

    private async assertMerchantOwnsShop(
        shopId: string,
        actor: IAuthUser
    ): Promise<void> {
        const shop = await this.db.shop.findUnique({
            where: { id: shopId },
            select: { merchantId: true },
        });
        if (!shop || shop.merchantId !== actor.userId) {
            throw new ForbiddenException('order.error.forbidden');
        }
    }

    /**
     * Compare-and-set update: only applies if the order is still in
     * `expected` status (and unpaid when cancelling), so two concurrent
     * transitions cannot both win. A lost race surfaces as HTTP 409.
     */
    private async guardedUpdate(
        id: string,
        expected: OrderStatus,
        data: Prisma.OrderUpdateInput,
        actor: IAuthUser
    ): Promise<OrderRow> {
        const cancelling = data.status === OrderStatus.CANCELLED;
        try {
            return await this.db.order.update({
                where: {
                    id,
                    status: expected,
                    ...(cancelling ? { isPaid: false } : {}),
                },
                data,
                include: orderInclude(actor),
            });
        } catch (error) {
            if (isPrismaError(error, PRISMA_RECORD_NOT_FOUND)) {
                throw new ConflictException('order.error.statusChanged');
            }
            throw error;
        }
    }
}
