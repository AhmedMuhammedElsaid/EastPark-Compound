import { NotificationType } from '@prisma/client';

export class NotificationResponseDto {
    id: string;
    type: NotificationType;
    title: string;
    titleAr: string;
    body: string;
    bodyAr: string;
    data: Record<string, unknown> | null;
    isRead: boolean;
    createdAt: Date;
}

export class NotificationListResponseDto {
    items: NotificationResponseDto[];
    nextCursor?: string;
    unreadCount: number;
}
