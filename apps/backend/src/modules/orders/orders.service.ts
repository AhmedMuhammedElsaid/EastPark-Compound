import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    NotificationType,
    OrderStatus,
    PaymentMethod,
    Role,
} from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { NotificationsService } from 'src/modules/notifications/notifications.service';

import { OrderCreateDto } from './dtos/request/order.create.dto';
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

@Injectable()
export class OrdersService {
    constructor(
        private readonly db: DatabaseService,
        private readonly gateway: OrdersGateway,
        private readonly notifications: NotificationsService
    ) {}

    async create(
        dto: OrderCreateDto,
        actor: IAuthUser
    ): Promise<OrderResponseDto> {
        const productIds = dto.items.map(i => i.productId);

        // Fetch all products in one query
        const products = await this.db.product.findMany({
            where: {
                id: { in: productIds },
                isDeleted: false,
                isAvailable: true,
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

        // Build item map for quantity lookup
        const productMap = new Map(products.map(p => [p.id, p]));

        // Compute total server-side
        let totalAmount = 0;
        const orderItems = dto.items.map(item => {
            const product = productMap.get(item.productId)!;
            const lineTotal = product.price * item.quantity;
            totalAmount += lineTotal;
            return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: product.price,
                productNameSnapshot: product.name,
                productNameArSnapshot: product.nameAr,
            };
        });

        const order = await this.db.order.create({
            data: {
                residentId: actor.userId,
                shopId,
                totalAmount,
                notes: dto.notes,
                deliveryUnit: dto.deliveryUnit,
                paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
                items: { create: orderItems },
            },
            include: { items: true },
        });

        return order;
    }

    async findAll(
        query: OrderQueryDto,
        actor: IAuthUser
    ): Promise<OrderListResponseDto> {
        const limit = query.limit ?? 20;

        // Build access-control where clause
        let where: Record<string, unknown> = {};
        if (actor.role === Role.RESIDENT) {
            where = { residentId: actor.userId };
        } else if (actor.role === Role.MERCHANT) {
            // Find the merchant's shops
            const shops = await this.db.shop.findMany({
                where: { merchantId: actor.userId },
                select: { id: true },
            });
            where = { shopId: { in: shops.map(s => s.id) } };
        }
        // ADMIN: no restriction

        if (query.status) where['status'] = query.status;

        const items = await this.db.order.findMany({
            where,
            take: limit + 1,
            ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
            orderBy: { createdAt: 'desc' },
            include: { items: true },
        });

        let nextCursor: string | undefined;
        if (items.length > limit) {
            const last = items.pop();
            nextCursor = last?.id;
        }

        return { items, nextCursor };
    }

    async findOne(id: string, actor: IAuthUser): Promise<OrderResponseDto> {
        const order = await this.db.order.findUnique({
            where: { id },
            include: { items: true },
        });

        if (!order) throw new NotFoundException('order.error.notFound');

        if (actor.role === Role.RESIDENT && order.residentId !== actor.userId) {
            throw new ForbiddenException('order.error.forbidden');
        }

        if (actor.role === Role.MERCHANT) {
            const shop = await this.db.shop.findUnique({
                where: { id: order.shopId },
            });
            if (!shop || shop.merchantId !== actor.userId) {
                throw new ForbiddenException('order.error.forbidden');
            }
        }

        return order;
    }

    async updateStatus(
        id: string,
        dto: OrderUpdateStatusDto,
        actor: IAuthUser
    ): Promise<OrderResponseDto> {
        const order = await this.db.order.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!order) throw new NotFoundException('order.error.notFound');

        if (actor.role === Role.MERCHANT) {
            const shop = await this.db.shop.findUnique({
                where: { id: order.shopId },
            });
            if (!shop || shop.merchantId !== actor.userId) {
                throw new ForbiddenException('order.error.forbidden');
            }
        }

        const updated = await this.db.order.update({
            where: { id },
            data: { status: dto.status },
            include: { items: true },
        });

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

        return updated;
    }

    async cancel(id: string, actor: IAuthUser): Promise<OrderResponseDto> {
        const order = await this.db.order.findUnique({
            where: { id },
            include: { items: true },
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

        const updated = await this.db.order.update({
            where: { id },
            data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
            include: { items: true },
        });

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

        return updated;
    }
}
