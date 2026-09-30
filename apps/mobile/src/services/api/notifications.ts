import { client } from "./client";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
};

export type NotificationPreference = {
  type: string;
  enabled: boolean;
};

export const notificationsApi = {
  getNotifications: (params?: { cursor?: string; limit?: number }) =>
    client.get<{ data: { items: AppNotification[]; nextCursor: string | null } }>("/notifications", { params }),

  markRead: (notificationId: string) =>
    client.patch<{ data: AppNotification }>(`/notifications/${notificationId}/read`),

  markAllRead: () =>
    client.patch<{ data: { success: boolean } }>("/notifications/read-all"),

  getPreferences: () =>
    client.get<{ data: NotificationPreference[] }>("/notifications/preferences"),

  updatePreference: (type: string, enabled: boolean) =>
    client.put<{ data: NotificationPreference }>(`/notifications/preferences/${type}`, { enabled }),
};
