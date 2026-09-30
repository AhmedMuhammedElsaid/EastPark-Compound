import {
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, PaymentMethod, Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { OrdersGateway } from 'src/modules/orders/orders.gateway';
import { OrdersService } from 'src/modules/orders/orders.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const residentActor = { userId: 'resident-1', role: Role.RESIDENT };
const merchantActor = { userId: 'merchant-1', role: Role.MERCHANT };

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
            db.order.create.mockResolvedValue(mockOrder({ totalAmount: 150 }));

            await service.create(
                { ...validDto, items: [{ productId: 'prod-1', quantity: 2 }] },
                residentActor
            );

            // The create call should use 75 * 2 = 150 computed server-side
            const createCall = db.order.create.mock.calls[0]?.[0];
            expect(createCall?.data?.totalAmount).toBe(150);
        });

        it('creates order with correct items on happy path', async () => {
            db.product.findMany.mockResolvedValue([
                mockProduct('prod-1', 'shop-1', 100),
            ]);
            db.order.create.mockResolvedValue(mockOrder());

            await service.create(validDto, residentActor);

            expect(db.order.create).toHaveBeenCalledTimes(1);
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
