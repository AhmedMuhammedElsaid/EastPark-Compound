import { z } from 'zod';

export const notificationTypes = [
  'ORDER_UPDATE',
  'ANNOUNCEMENT',
  'POLL',
  'ELECTION',
  'FEEDBACK_UPDATE',
] as const;

export type NotificationType = (typeof notificationTypes)[number];

const notificationTypeSchema = z.enum(notificationTypes);

const notificationSchema = z.object({
  id: z.string().min(1),
  type: notificationTypeSchema,
  title: z.string(),
  titleAr: z.string(),
  body: z.string(),
  bodyAr: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
  isRead: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
});

const notificationPageEnvelopeSchema = z.object({
  data: z.object({
    items: z.array(notificationSchema),
    nextCursor: z.string().optional(),
    unreadCount: z.number().int().nonnegative(),
  }),
});

const notificationPreferenceSchema = z.object({
  type: notificationTypeSchema,
  enabled: z.boolean(),
});

const notificationPreferencesEnvelopeSchema = z.object({
  data: z.array(notificationPreferenceSchema),
});

const markAllReadEnvelopeSchema = z.object({
  data: z.object({ count: z.number().int().nonnegative() }),
});

export type AppNotification = z.infer<typeof notificationSchema>;
export type NotificationPage = z.infer<typeof notificationPageEnvelopeSchema>['data'];
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

export function isNotificationType(value: string): value is NotificationType {
  return notificationTypes.some((type) => type === value);
}

export function parseNotificationPage(payload: unknown): NotificationPage {
  return notificationPageEnvelopeSchema.parse(payload).data;
}

export function parseNotificationPreferences(payload: unknown): NotificationPreference[] {
  return notificationPreferencesEnvelopeSchema.parse(payload).data;
}

export function parseNotificationPreference(payload: unknown): NotificationPreference {
  return z.object({ data: notificationPreferenceSchema }).parse(payload).data;
}

export function parseMarkAllRead(payload: unknown): { count: number } {
  return markAllReadEnvelopeSchema.parse(payload).data;
}