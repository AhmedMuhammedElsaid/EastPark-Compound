import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { NotificationsService } from 'src/modules/notifications/notifications.service';

// expo-server-sdk is mocked via jest.json moduleNameMapper → test/mocks/expo.mock.ts

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const actor = { userId: 'user-1', role: 'RESIDENT' as any };

const validExpoPushToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxx]';

const mockNotification = (overrides: Record<string, unknown> = {}) => ({
    id: 'notif-1',
    userId: 'user-1',
    type: NotificationType.ORDER_UPDATE,
    title: 'Order confirmed',
    titleAr: 'تم تأكيد الطلب',
    body: 'Your order is confirmed',
    bodyAr: 'تم تأكيد طلبك',
    data: {},
    isRead: false,
    createdAt: new Date(),
    ...overrides,
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const db = {
    notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
    },
    user: {
        findUnique: jest.fn(),
    },
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('NotificationsService', () => {
    let service: NotificationsService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationsService,
                { provide: DatabaseService, useValue: db },
            ],
        }).compile();

        service = module.get(NotificationsService);
    });

    // ── send ──────────────────────────────────────────────────────────────────

    describe('send', () => {
        const sendArgs: Parameters<NotificationsService['send']> = [
            'user-1',
            NotificationType.ORDER_UPDATE,
            'Order confirmed',
            'تم تأكيد الطلب',
            'Your order is ready',
            'طلبك جاهز',
            { orderId: 'order-1' },
        ];

        it('always persists an in-app notification record', async () => {
            db.notification.create.mockResolvedValue({});
            db.user.findUnique.mockResolvedValue({
                pushToken: null,
                notificationPrefs: [],
            });

            await service.send(...sendArgs);

            expect(db.notification.create).toHaveBeenCalledTimes(1);
        });

        it('skips push send when user has no pushToken', async () => {
            db.notification.create.mockResolvedValue({});
            db.user.findUnique.mockResolvedValue({
                pushToken: null,
                notificationPrefs: [],
            });

            // No error should be thrown, Expo SDK should not be called
            await expect(service.send(...sendArgs)).resolves.toBeUndefined();
        });

        it('skips push send when preference is explicitly disabled', async () => {
            db.notification.create.mockResolvedValue({});
            db.user.findUnique.mockResolvedValue({
                pushToken: validExpoPushToken,
                notificationPrefs: [
                    { type: NotificationType.ORDER_UPDATE, enabled: false },
                ],
            });

            await expect(service.send(...sendArgs)).resolves.toBeUndefined();
        });

        it('sends push when user has a valid token and preference is enabled', async () => {
            db.notification.create.mockResolvedValue({});
            db.user.findUnique.mockResolvedValue({
                pushToken: validExpoPushToken,
                notificationPrefs: [
                    { type: NotificationType.ORDER_UPDATE, enabled: true },
                ],
            });

            // No error thrown — Expo mock handles it
            await expect(service.send(...sendArgs)).resolves.toBeUndefined();
            expect(db.notification.create).toHaveBeenCalledTimes(1);
        });

        it('sends push when no preference row exists (default = enabled)', async () => {
            db.notification.create.mockResolvedValue({});
            db.user.findUnique.mockResolvedValue({
                pushToken: validExpoPushToken,
                notificationPrefs: [], // no row = default enabled
            });

            await expect(service.send(...sendArgs)).resolves.toBeUndefined();
        });
    });

    // ── findAll ───────────────────────────────────────────────────────────────

    describe('findAll', () => {
        it('returns paginated notifications and unread count', async () => {
            const notifs = [
                mockNotification(),
                mockNotification({ id: 'notif-2' }),
            ];
            db.notification.findMany.mockResolvedValue(notifs);
            db.notification.count.mockResolvedValue(1);

            const result = await service.findAll(actor, { limit: 20 });

            expect(result.items).toHaveLength(2);
            expect(result.unreadCount).toBe(1);
            expect(result.nextCursor).toBeUndefined();
        });

        it('paginates and returns nextCursor when over limit', async () => {
            const notifs = Array.from({ length: 6 }, (_, i) =>
                mockNotification({ id: `notif-${i}` })
            );
            db.notification.findMany.mockResolvedValue(notifs);
            db.notification.count.mockResolvedValue(3);

            const result = await service.findAll(actor, { limit: 5 });

            expect(result.items).toHaveLength(5);
            expect(result.nextCursor).toBe('notif-5');
        });
    });

    // ── markRead ──────────────────────────────────────────────────────────────

    describe('markRead', () => {
        it('throws NotFoundException when notification does not exist', async () => {
            db.notification.findUnique.mockResolvedValue(null);
            await expect(
                service.markRead('bad-id', actor)
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it('throws NotFoundException when notification belongs to a different user', async () => {
            db.notification.findUnique.mockResolvedValue(
                mockNotification({ userId: 'other-user' })
            );
            await expect(
                service.markRead('notif-1', actor)
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it('marks the notification as read', async () => {
            db.notification.findUnique.mockResolvedValue(mockNotification());
            db.notification.update.mockResolvedValue({});

            await service.markRead('notif-1', actor);

            expect(db.notification.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: { isRead: true } })
            );
        });
    });

    // ── markAllRead ───────────────────────────────────────────────────────────

    describe('markAllRead', () => {
        it('updates all unread notifications for the actor and returns count', async () => {
            db.notification.updateMany.mockResolvedValue({ count: 4 });

            const result = await service.markAllRead(actor);

            expect(db.notification.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: actor.userId, isRead: false },
                    data: { isRead: true },
                })
            );
            expect(result.count).toBe(4);
        });
    });
});
