import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import Expo from 'expo-server-sdk';

import { DatabaseService } from 'src/common/database/services/database.service';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { NotificationQueryDto } from './dtos/request/notification.query.dto';
import { NotificationPreferenceResponseDto } from './dtos/response/notification.preference.response.dto';
import {
    NotificationListResponseDto,
    NotificationResponseDto,
} from './dtos/response/notification.response.dto';

const expo = new Expo();

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(private readonly db: DatabaseService) {}

    /**
     * Send a push notification to a user (if they have a push token and the
     * notification type is enabled in their preferences) and always persist
     * an in-app record.
     */
    async send(
        userId: string,
        type: NotificationType,
        title: string,
        titleAr: string,
        body: string,
        bodyAr: string,
        data?: Record<string, unknown>
    ): Promise<void> {
        // Persist in-app record unconditionally
        await this.db.notification.create({
            data: {
                userId,
                type,
                title,
                titleAr,
                body,
                bodyAr,
                data: (data ?? {}) as any,
            },
        });

        // Check user's push token and notification preference
        const user = await this.db.user.findUnique({
            where: { id: userId },
            select: {
                pushToken: true,
                notificationPrefs: { where: { type } },
            },
        });

        if (!user?.pushToken) return;

        // Default preference is enabled; only skip if explicitly disabled
        const pref = user.notificationPrefs[0];
        const isEnabled = pref ? pref.enabled : true;
        if (!isEnabled) return;

        if (!Expo.isExpoPushToken(user.pushToken)) {
            this.logger.warn(
                `Invalid Expo push token for user ${userId}: ${user.pushToken}`
            );
            return;
        }

        try {
            const chunks = expo.chunkPushNotifications([
                {
                    to: user.pushToken,
                    sound: 'default',
                    title,
                    body,
                    data: data ?? {},
                },
            ]);

            for (const chunk of chunks) {
                const receipts = await expo.sendPushNotificationsAsync(chunk);
                for (const receipt of receipts) {
                    if (receipt.status === 'error') {
                        this.logger.error(
                            `Expo push error for user ${userId}: ${receipt.message}`
                        );
                    }
                }
            }
        } catch (err) {
            this.logger.error(
                `Failed to send push to user ${userId}: ${(err as Error).message}`
            );
        }
    }

    async findAll(
        actor: IAuthUser,
        query: NotificationQueryDto
    ): Promise<NotificationListResponseDto> {
        const limit = query.limit ?? 20;

        const where: Record<string, unknown> = { userId: actor.userId };
        if (query.isRead !== undefined) where.isRead = query.isRead;

        const [notifications, unreadCount] = await Promise.all([
            this.db.notification.findMany({
                where,
                take: limit + 1,
                ...(query.cursor
                    ? { skip: 1, cursor: { id: query.cursor } }
                    : {}),
                orderBy: { createdAt: 'desc' },
            }),
            this.db.notification.count({
                where: { userId: actor.userId, isRead: false },
            }),
        ]);

        let nextCursor: string | undefined;
        if (notifications.length > limit) {
            const last = notifications.pop();
            nextCursor = last?.id;
        }

        const items: NotificationResponseDto[] = notifications.map(n => ({
            id: n.id,
            type: n.type,
            title: n.title,
            titleAr: n.titleAr,
            body: n.body,
            bodyAr: n.bodyAr,
            data: n.data as Record<string, unknown> | null,
            isRead: n.isRead,
            createdAt: n.createdAt,
        }));

        return { items, nextCursor, unreadCount };
    }

    async markRead(id: string, actor: IAuthUser): Promise<void> {
        const notification = await this.db.notification.findUnique({
            where: { id },
        });
        if (!notification || notification.userId !== actor.userId) {
            throw new NotFoundException('notification.error.notFound');
        }

        await this.db.notification.update({
            where: { id },
            data: { isRead: true },
        });
    }

    async markAllRead(actor: IAuthUser): Promise<{ count: number }> {
        const result = await this.db.notification.updateMany({
            where: { userId: actor.userId, isRead: false },
            data: { isRead: true },
        });
        return { count: result.count };
    }

    async getPreferences(userId: string): Promise<NotificationPreferenceResponseDto[]> {
        const rows = await this.db.notificationPreference.findMany({
            where: { userId },
        });
        return Object.values(NotificationType).map(type => {
            const row = rows.find(r => r.type === type);
            return { type, enabled: row ? row.enabled : true };
        });
    }

    async updatePreference(userId: string, type: NotificationType, enabled: boolean): Promise<NotificationPreferenceResponseDto> {
        const pref = await this.db.notificationPreference.upsert({
            where: { userId_type: { userId, type } },
            create: { userId, type, enabled },
            update: { enabled },
        });
        return { type: pref.type, enabled: pref.enabled };
    }
}
