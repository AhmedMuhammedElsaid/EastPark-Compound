import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, PaymentMethod, Prisma, Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { OrdersGateway } from 'src/modules/orders/orders.gateway';
import {
    OrdersService,
    canTransitionOrder,
    toOrderResponse,
} from 'src/modules/orders/orders.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const residentActor = { userId: 'resident-1', role: Role.RESIDENT };
const merchantActor = { userId: 'merchant-1', role: Role.MERCHANT };
const adminActor = { userId: 'admin-1', role: Role.ADMIN };

const mockProduct = (id: string, shopId: string, price = 50) => ({
    id,
    shopId,
    price,
    isDeleted: false,
    isAvailable: true,
});

const mockOrder = (overrides: Record<string, unknown> = {}) => ({
    id: 'order-1',
    residentId: 'resident-1',
    shopId: 'shop-1',
    status: OrderStatus.PLACED,
    totalAmount: 100,
    items: [],
    isPaid: false,
    cancelledAt: null,
    ...overrides,
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const db = {
    product: { findMany: jest.fn() },
    shop: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
    order: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
    },
};

const gateway = { emitStatusUpdate: jest.fn() };

const notifications = {
    send: jest.fn().mockResolvedValue(undefined),
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('OrdersService', () => {
    let service: OrdersService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrdersService,
                { provide: DatabaseService, useValue: db },
                { provide: OrdersGateway, useValue: gateway },
                { provide: NotificationsService, useValue: notifications },
            ],
        }).compile();

        service = module.get(OrdersService);
    });

    // ── create ────────────────────────────────────────────────────────────────

    describe('create', () => {
        const validDto = {
            shopId: 'shop-1',
            items: [{ productId: 'prod-1', quantity: 2 }],
            deliveryUnit: 'A1',
            paymentMethod: PaymentMethod.CASH,
            notes: '',
        };

        it('throws BadRequestException when a product is unavailable', async () => {
            // findMany returns fewer products than requested → some unavailable
            db.product.findMany.mockResolvedValue([]);

            await expect(
                service.create(validDto, residentActor)
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it('throws BadRequestException when items span multiple shops', async () => {
            db.product.findMany.mockResolvedValue([
                mockProduct('prod-1', 'shop-1'),
                mockProduct('prod-2', 'shop-2'), // different shop!
            ]);

            await expect(
                service.create(
                    {
                        ...validDto,
                        items: [
                            { productId: 'prod-1', quantity: 1 },
                            { productId: 'prod-2', quantity: 1 },
                        ],
                    },
                    residentActor
                )
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it('computes totalAmount server-side and ignores any client-supplied value', async () => {
            db.product.findMany.mockResolvedValue([
                mockProduct('prod-1', 'shop-1', 75),
            ]);
            db.shop.findUnique.mockResolvedValue({ isOpen: true });
            db.order.create.mockResolvedValue(mockOrder({ totalAmount: 150 }));

            await service.create(
                { ...validDto, items: [{ productId: 'prod-1', quantity: 2 }] },
                residentActor
            );

            // The create call should use 75 * 2 = 150 computed server-side
            const createCall = db.order.create.mock.calls[0]?.[0];
            expect(createCall?.data?.totalAmount).toBeInstanceOf(
                Prisma.Decimal
            );
            expect(createCall?.data?.totalAmount.toFixed(2)).toBe('150.00');
        });

        it('sums money in exact decimal arithmetic (no float drift)', async () => {
            db.product.findMany.mockResolvedValue([
                mockProduct('prod-1', 'shop-1', 0.1),
                mockProduct('prod-2', 'shop-1', 0.2),
            ]);
            db.shop.findUnique.mockResolvedValue({ isOpen: true });
            db.order.create.mockResolvedValue(mockOrder());

            await service.create(
                {
                    ...validDto,
                    items: [
                        { productId: 'prod-1', quantity: 1 },
                        { productId: 'prod-2', quantity: 1 },
                    ],
                },
                residentActor
            );

            const createCall = db.order.create.mock.calls[0]?.[0];
            // 0.1 + 0.2 in JS floats is 0.30000000000000004
            expect(createCall?.data?.totalAmount.toString()).toBe('0.3');
        });

        it('creates order with correct items on happy path', async () => {
            db.product.findMany.mockResolvedValue([
                mockProduct('prod-1', 'shop-1', 100),
            ]);
            db.shop.findUnique.mockResolvedValue({ isOpen: true });
            db.order.create.mockResolvedValue(mockOrder());

            await service.create(validDto, residentActor);

            expect(db.order.create).toHaveBeenCalledTimes(1);
            // Residents never get the resident summary included.
            expect(db.order.create.mock.calls[0][0].include).toEqual({
                items: true,
                shop: { select: { id: true, name: true, nameAr: true } },
            });
        });

        it('rejects an order for a manually closed shop (409)', async () => {
            db.product.findMany.mockResolvedValue([
                mockProduct('prod-1', 'shop-1', 100),
            ]);
            db.shop.findUnique.mockResolvedValue({ isOpen: false });

            await expect(
                service.create(validDto, residentActor)
            ).rejects.toBeInstanceOf(ConflictException);
            expect(db.order.create).not.toHaveBeenCalled();
        });

        it('rejects duplicate products in one order', async () => {
            await expect(
                service.create(
                    {
                        ...validDto,
                        items: [
                            { productId: 'prod-1', quantity: 1 },
                            { productId: 'prod-1', quantity: 2 },
                        ],
                    },
                    residentActor
                )
            ).rejects.toBeInstanceOf(BadRequestException);
            expect(db.product.findMany).not.toHaveBeenCalled();
        });
    });

    // ── response mapping ──────────────────────────────────────────────────────

    describe('toOrderResponse', () => {
        it('returns numeric money, lineTotal, shop and resident summary', () => {
            const response = toOrderResponse({
                ...(mockOrder() as never),
                totalAmount: new Prisma.Decimal('31.50'),
                items: [
                    {
                        id: 'item-1',
                        orderId: 'order-1',
                        productId: 'prod-1',
                        productNameSnapshot: 'Latte',
                        productNameArSnapshot: 'لاتيه',
                        quantity: 3,
                        unitPrice: new Prisma.Decimal('10.50'),
                    },
                ],
                shop: { id: 'shop-1', name: 'Cafe', nameAr: 'كافيه' },
                resident: { id: 'resident-1', name: 'Ali', unitNumber: 'B2' },
            });

            expect(response.totalAmount).toBe(31.5);
            expect(response.items[0]).toEqual(
                expect.objectContaining({ unitPrice: 10.5, lineTotal: 31.5 })
            );
            expect(response.shop).toEqual({
                id: 'shop-1',
                name: 'Cafe',
                nameAr: 'كافيه',
            });
            expect(response.resident).toEqual({
                id: 'resident-1',
                name: 'Ali',
                unitNumber: 'B2',
            });
            expect(JSON.parse(JSON.stringify(response)).totalAmount).toBe(31.5);
        });

        it('includes only id/name/unitNumber of the resident for merchants', async () => {
            db.order.findUnique.mockResolvedValue(mockOrder());
            db.shop.findUnique.mockResolvedValue({ merchantId: 'merchant-1' });

            await service.findOne('order-1', merchantActor);

            expect(db.order.findUnique.mock.calls[0][0].include).toEqual({
                items: true,
                shop: { select: { id: true, name: true, nameAr: true } },
                resident: {
                    select: { id: true, name: true, unitNumber: true },
                },
            });
        });
    });

    // ── state machine ─────────────────────────────────────────────────────────

    describe('canTransitionOrder', () => {
        const flow = [
            OrderStatus.PLACED,
            OrderStatus.CONFIRMED,
            OrderStatus.PREPARING,
            OrderStatus.READY,
            OrderStatus.ON_THE_WAY,
            OrderStatus.DELIVERED,
        ];

        it('allows each forward step of the happy path', () => {
            for (let i = 0; i < flow.length - 1; i++) {
                expect(canTransitionOrder(flow[i]!, flow[i + 1]!)).toBe(true);
            }
        });

        it('rejects skipping, going backwards and repeating a status', () => {
            expect(
                canTransitionOrder(OrderStatus.PLACED, OrderStatus.READY)
            ).toBe(false);
            expect(
                canTransitionOrder(OrderStatus.READY, OrderStatus.CONFIRMED)
            ).toBe(false);
            expect(
                canTransitionOrder(OrderStatus.CONFIRMED, OrderStatus.CONFIRMED)
            ).toBe(false);
        });

        it('allows CANCELLED only before DELIVERED', () => {
            for (const status of flow.slice(0, -1)) {
                expect(canTransitionOrder(status, OrderStatus.CANCELLED)).toBe(
                    true
                );
            }
            expect(
                canTransitionOrder(OrderStatus.DELIVERED, OrderStatus.CANCELLED)
            ).toBe(false);
            expect(
                canTransitionOrder(OrderStatus.CANCELLED, OrderStatus.PLACED)
            ).toBe(false);
        });
    });

    // ── updateStatus ──────────────────────────────────────────────────────────

    describe('updateStatus', () => {
        it('throws NotFoundException when order does not exist', async () => {
            db.order.findUnique.mockResolvedValue(null);
            await expect(
                service.updateStatus(
                    'bad-id',
                    { status: OrderStatus.CONFIRMED },
                    merchantActor
                )
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it('throws ForbiddenException when merchant tries to update another shop order', async () => {
            db.order.findUnique.mockResolvedValue(
                mockOrder({ shopId: 'shop-1' })
            );
            db.shop.findUnique.mockResolvedValue({
                id: 'shop-1',
                merchantId: 'other-merchant', // different merchant
            });

            await expect(
                service.updateStatus(
                    'order-1',
                    { status: OrderStatus.CONFIRMED },
                    merchantActor
                )
            ).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('emits WebSocket event and sends notification after status update', async () => {
            db.order.findUnique.mockResolvedValue(
                mockOrder({ shopId: 'shop-1' })
            );
            db.shop.findUnique.mockResolvedValue({
                id: 'shop-1',
                merchantId: 'merchant-1',
            });
            db.order.update.mockResolvedValue(
                mockOrder({
                    status: OrderStatus.CONFIRMED,
                    residentId: 'resident-1',
                })
            );

            await service.updateStatus(
                'order-1',
                { status: OrderStatus.CONFIRMED },
                merchantActor
            );

            // Compare-and-set on the status read before the update
            expect(db.order.update.mock.calls[0][0].where).toEqual({
                id: 'order-1',
                status: OrderStatus.PLACED,
            });
            expect(gateway.emitStatusUpdate).toHaveBeenCalledWith(
                'order-1',
                OrderStatus.CONFIRMED
            );
            expect(notifications.send).toHaveBeenCalledWith(
                'resident-1',
                'ORDER_UPDATE',
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.objectContaining({ orderId: 'order-1' })
            );
        });

        it('rejects an invalid transition with 409 and does not write', async () => {
            db.order.findUnique.mockResolvedValue(
                mockOrder({ status: OrderStatus.PLACED })
            );
            db.shop.findUnique.mockResolvedValue({ merchantId: 'merchant-1' });

            await expect(
                service.updateStatus(
                    'order-1',
                    { status: OrderStatus.DELIVERED },
                    merchantActor
                )
            ).rejects.toBeInstanceOf(ConflictException);
            expect(db.order.update).not.toHaveBeenCalled();
            expect(gateway.emitStatusUpdate).not.toHaveBeenCalled();
        });

        it('rejects cancelling a DELIVERED order', async () => {
            db.order.findUnique.mockResolvedValue(
                mockOrder({ status: OrderStatus.DELIVERED })
            );
            await expect(
                service.updateStatus(
                    'order-1',
                    { status: OrderStatus.CANCELLED },
                    adminActor
                )
            ).rejects.toBeInstanceOf(ConflictException);
        });

        it('rejects cancelling a paid order (409)', async () => {
            db.order.findUnique.mockResolvedValue(
                mockOrder({ status: OrderStatus.PREPARING, isPaid: true })
            );
            await expect(
                service.updateStatus(
                    'order-1',
                    { status: OrderStatus.CANCELLED },
                    adminActor
                )
            ).rejects.toThrow('order.error.cannotCancelPaidOrder');
            expect(db.order.update).not.toHaveBeenCalled();
        });

        it('sets cancelledAt when merchant/admin cancels', async () => {
            db.order.findUnique.mockResolvedValue(
                mockOrder({ status: OrderStatus.READY, isPaid: false })
            );
            db.order.update.mockResolvedValue(
                mockOrder({ status: OrderStatus.CANCELLED })
            );

            await service.updateStatus(
                'order-1',
                { status: OrderStatus.CANCELLED },
                adminActor
            );

            expect(db.order.update.mock.calls[0][0]).toEqual(
                expect.objectContaining({
                    where: {
                        id: 'order-1',
                        status: OrderStatus.READY,
                        isPaid: false,
                    },
                    data: {
                        status: OrderStatus.CANCELLED,
                        cancelledAt: expect.any(Date),
                    },
                })
            );
        });

        it('maps a lost concurrent update (P2025) to 409', async () => {
            db.order.findUnique.mockResolvedValue(
                mockOrder({ status: OrderStatus.PLACED })
            );
            db.order.update.mockRejectedValue(
                new Prisma.PrismaClientKnownRequestError('not found', {
                    code: 'P2025',
                    clientVersion: 'test',
                })
            );

            await expect(
                service.updateStatus(
                    'order-1',
                    { status: OrderStatus.CONFIRMED },
                    adminActor
                )
            ).rejects.toThrow('order.error.statusChanged');
        });
    });

    // ── cancel ────────────────────────────────────────────────────────────────

    describe('cancel', () => {
        it('throws NotFoundException when order does not exist', async () => {
            db.order.findUnique.mockResolvedValue(null);
            await expect(
                service.cancel('bad-id', residentActor)
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it('throws ForbiddenException when resident tries to cancel someone else order', async () => {
            db.order.findUnique.mockResolvedValue(
                mockOrder({ residentId: 'other-resident' })
            );
            await expect(
                service.cancel('order-1', residentActor)
            ).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('throws BadRequestException when order is past PLACED status', async () => {
            db.order.findUnique.mockResolvedValue(
                mockOrder({ status: OrderStatus.PREPARING })
            );
            await expect(
                service.cancel('order-1', residentActor)
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it('rejects resident cancel of a paid PLACED order (409)', async () => {
            db.order.findUnique.mockResolvedValue(mockOrder({ isPaid: true }));
            await expect(
                service.cancel('order-1', residentActor)
            ).rejects.toBeInstanceOf(ConflictException);
            expect(db.order.update).not.toHaveBeenCalled();
        });

        it('cancels order and notifies merchant', async () => {
            db.order.findUnique.mockResolvedValue(mockOrder());
            db.order.update.mockResolvedValue(
                mockOrder({ status: OrderStatus.CANCELLED })
            );
            db.shop.findUnique.mockResolvedValue({ merchantId: 'merchant-1' });

            await service.cancel('order-1', residentActor);

            expect(db.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: OrderStatus.CANCELLED,
                        cancelledAt: expect.any(Date),
                    }),
                })
            );
            expect(gateway.emitStatusUpdate).toHaveBeenCalledWith(
                'order-1',
                OrderStatus.CANCELLED
            );
            expect(notifications.send).toHaveBeenCalledWith(
                'merchant-1',
                'ORDER_UPDATE',
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.objectContaining({ status: OrderStatus.CANCELLED })
            );
        });
    });
});
