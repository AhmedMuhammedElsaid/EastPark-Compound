import { z } from 'zod';

export const notificationTypes = [
  'ORDER_UPDATE',
  'ANNOUNCEMENT',
  'POLL',
  'ELECTION',
  'FEEDBACK_UPDATE',
  'LISTING_UPDATE',
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

// Items and preferences are validated one by one (see `keepKnown`) so a notification type
// added by a newer backend is ignored instead of failing the whole page.
const notificationPageEnvelopeSchema = z.object({
  data: z.object({
    items: z.array(z.unknown()),
    nextCursor: z.string().optional(),
    unreadCount: z.number().int().nonnegative(),
  }),
});

const notificationPreferenceSchema = z.object({
  type: notificationTypeSchema,
  enabled: z.boolean(),
});

const notificationPreferencesEnvelopeSchema = z.object({
  data: z.array(z.unknown()),
});

const markAllReadEnvelopeSchema = z.object({
  data: z.object({ count: z.number().int().nonnegative() }),
});

export type AppNotification = z.infer<typeof notificationSchema>;
export type NotificationPage = Omit<z.infer<typeof notificationPageEnvelopeSchema>['data'], 'items'> & {
  items: AppNotification[];
};
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

export function isNotificationType(value: string): value is NotificationType {
  return notificationTypes.some((type) => type === value);
}

function keepKnown<T>(rows: unknown[], schema: z.ZodType<T>): T[] {
  const kept: T[] = [];
  for (const row of rows) {
    const parsed = schema.safeParse(row);
    if (parsed.success) kept.push(parsed.data);
  }
  return kept;
}

export function parseNotificationPage(payload: unknown): NotificationPage {
  const data = notificationPageEnvelopeSchema.parse(payload).data;
  return { ...data, items: keepKnown(data.items, notificationSchema) };
}

export function parseNotificationPreferences(payload: unknown): NotificationPreference[] {
  return keepKnown(notificationPreferencesEnvelopeSchema.parse(payload).data, notificationPreferenceSchema);
}

export function parseNotificationPreference(payload: unknown): NotificationPreference {
  return z.object({ data: notificationPreferenceSchema }).parse(payload).data;
}

export function parseMarkAllRead(payload: unknown): { count: number } {
  return markAllReadEnvelopeSchema.parse(payload).data;
}