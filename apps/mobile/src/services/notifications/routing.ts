/**
 * Maps a notification (push payload or in-app record) to the screen it opens.
 *
 * Backend contract (NotificationType enum): ORDER_UPDATE, ANNOUNCEMENT, POLL,
 * ELECTION, FEEDBACK_UPDATE. Push payloads currently carry only the `data`
 * object (e.g. ORDER_UPDATE → `{ orderId, status }`) — no `type` and no
 * `referenceId` — so the type is inferred from the id key when absent.
 * `referenceId` is still honoured for forward compatibility.
 */

export type NotificationType = "ORDER_UPDATE" | "ANNOUNCEMENT" | "POLL" | "ELECTION" | "FEEDBACK_UPDATE";

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "ORDER_UPDATE",
  "ANNOUNCEMENT",
  "POLL",
  "ELECTION",
  "FEEDBACK_UPDATE",
];

const ID_KEY_BY_TYPE: Record<NotificationType, string> = {
  ORDER_UPDATE: "orderId",
  ANNOUNCEMENT: "announcementId",
  POLL: "pollId",
  ELECTION: "electionId",
  FEEDBACK_UPDATE: "feedbackId",
};

const ROUTE_BY_TYPE: Record<NotificationType, (id: string) => string> = {
  ORDER_UPDATE: id => `/(tabs)/orders/${id}`,
  ANNOUNCEMENT: id => `/(tabs)/community/${id}`,
  POLL: id => `/(tabs)/community/governance/polls/${id}`,
  ELECTION: id => `/(tabs)/community/governance/elections/${id}`,
  FEEDBACK_UPDATE: id => `/(tabs)/community/feedback/${id}`,
};

function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

function asId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Returns the route for a notification, or null when it cannot be resolved. */
export function getNotificationHref(
  type: unknown,
  data: Record<string, unknown> | null | undefined,
): string | null {
  const payload = data ?? {};
  let resolvedType: NotificationType | null = isNotificationType(type)
    ? type
    : isNotificationType(payload.type) ? payload.type : null;

  if (!resolvedType) {
    resolvedType = NOTIFICATION_TYPES.find(t => asId(payload[ID_KEY_BY_TYPE[t]])) ?? null;
  }
  if (!resolvedType)
    return null;

  const id = asId(payload[ID_KEY_BY_TYPE[resolvedType]]) ?? asId(payload.referenceId);
  return id ? ROUTE_BY_TYPE[resolvedType](id) : null;
}
