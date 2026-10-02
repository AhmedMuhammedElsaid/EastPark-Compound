import type { NotificationType } from "@/services/notifications/routing";

import { client } from "./client";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
};

export type NotificationPage = {
  items: AppNotification[];
  nextCursor: string | null;
  /** Server-side unread count across ALL pages. */
  unreadCount: number;
};

export type NotificationPreference = {
  type: string;
  enabled: boolean;
};

export const notificationsApi = {
  getNotifications: (params?: { cursor?: string; limit?: number }) =>
    client.get<{ data: NotificationPage }>("/notifications", { params }),

  markRead: (notificationId: string) =>
    client.patch(`/notifications/${notificationId}/read`),

  markAllRead: () =>
    client.patch("/notifications/read-all"),

  getPreferences: () =>
    client.get<{ data: NotificationPreference[] }>("/notifications/preferences"),

  updatePreference: (type: string, enabled: boolean) =>
    client.put<{ data: NotificationPreference }>(`/notifications/preferences/${type}`, { enabled }),
};
