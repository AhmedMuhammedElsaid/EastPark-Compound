import type { NotificationPreference } from "@/services/api/notifications";

/** Backend `NotificationType`, in the order the settings list shows them. */
export const NOTIFICATION_TYPES = ["ORDER_UPDATE", "ANNOUNCEMENT", "POLL", "ELECTION", "FEEDBACK_UPDATE"] as const;

export type PreferenceType = typeof NOTIFICATION_TYPES[number];

/**
 * One row per known type in a fixed order. The backend answers every type
 * (missing rows default to enabled); this keeps the list stable if a type is
 * absent and drops types this build does not know.
 */
export function normalizePreferences(rows: readonly NotificationPreference[] | null | undefined): NotificationPreference[] {
  return NOTIFICATION_TYPES.map((type) => {
    const row = rows?.find(r => r.type === type);
    return { type, enabled: row ? row.enabled !== false : true };
  });
}

/** The list with one type switched; other rows are untouched. */
export function withPreference(rows: readonly NotificationPreference[], type: string, enabled: boolean): NotificationPreference[] {
  return rows.map(row => (row.type === type ? { ...row, enabled } : row));
}
