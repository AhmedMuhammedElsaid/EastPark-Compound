/**
 * Turns an admin activity entry into a readable sentence: "<actor> <verb>: <label>", e.g.
 * EN "Sameh approved unit registration: …" / AR "سامح قبل تسجيل وحدة: …". Pure; takes the `t`
 * function so it is testable against the real ar/en dictionaries.
 */
import type { ActivityItem } from '@/lib/validation/super-admin';

import { ROLES } from '@/lib/auth/roles';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** Every action in the shared contract. Anything else renders generically. */
export const KNOWN_ACTIONS = [
  'LEAD_APPROVED',
  'LEAD_REJECTED',
  'INVITATION_SENT',
  'USER_DELETED',
  'USER_ROLE_CHANGED',
  'ANNOUNCEMENT_CREATED',
  'ANNOUNCEMENT_UPDATED',
  'ANNOUNCEMENT_DELETED',
  'COMMENT_DELETED',
  'POLL_CREATED',
  'POLL_UPDATED',
  'POLL_DELETED',
  'ELECTION_CREATED',
  'ELECTION_UPDATED',
  'ELECTION_DELETED',
  'ELECTION_CANDIDATE_ADDED',
  'ELECTION_RESULTS_OPENED',
  'REPORT_CREATED',
  'REPORT_DELETED',
  'FEEDBACK_REPLIED',
  'FEEDBACK_STATUS_CHANGED',
  'SHOP_CREATED',
  'SHOP_UPDATED',
  'SHOP_DELETED',
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PRODUCT_DELETED',
  'ORDER_STATUS_CHANGED',
] as const;
export type KnownAction = (typeof KNOWN_ACTIONS)[number];

const KNOWN = new Set<string>(KNOWN_ACTIONS);
const FEEDBACK_STATUSES = new Set(['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED']);

export function isKnownAction(action: string): action is KnownAction {
  return KNOWN.has(action);
}

/** "SHOP_ARCHIVED" → "shop archived". */
export function humaniseCode(code: string): string {
  return code
    .split(/[_\s]+/)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Localised role name, or the humanised code for a role the app doesn't know. */
export function roleLabel(role: string, t: Translate): string {
  return (ROLES as readonly string[]).includes(role) ? t(`profile.roles.${role.toLowerCase()}`) : humaniseCode(role);
}

export type ActivityParts = {
  actor: string;
  verb: string;
  /** `meta.label`, the short human target; null when the backend sent none. */
  label: string | null;
  /** Optional secondary line (role change, invited role, new status). */
  detail: string | null;
};

export function activityParts(item: Pick<ActivityItem, 'action' | 'meta' | 'actor'>, t: Translate): ActivityParts {
  const meta = item.meta ?? {};
  const actor = text(item.actor.name) ?? text(item.actor.email) ?? t('admin_activity.unknown_actor');
  const verb = isKnownAction(item.action)
    ? t(`admin_activity.actions.${item.action}`)
    : t('admin_activity.generic_action', { action: humaniseCode(item.action) });

  let detail: string | null = null;
  const fromRole = text(meta.fromRole);
  const toRole = text(meta.toRole);
  const role = text(meta.role);
  const status = text(meta.status);
  if (item.action === 'USER_ROLE_CHANGED' && fromRole && toRole) {
    detail = t('admin_activity.detail.role_change', { from: roleLabel(fromRole, t), to: roleLabel(toRole, t) });
  } else if (item.action === 'INVITATION_SENT' && role) {
    detail = t('admin_activity.detail.role', { role: roleLabel(role, t) });
  } else if (status && item.action.endsWith('STATUS_CHANGED')) {
    const statusText =
      item.action === 'FEEDBACK_STATUS_CHANGED' && FEEDBACK_STATUSES.has(status)
        ? t(`admin_ops.feedback_labels.${status}`)
        : humaniseCode(status);
    detail = t('admin_activity.detail.status', { status: statusText });
  }

  return { actor, verb, label: text(meta.label), detail };
}

/** The plain-text sentence (for tests, titles and screen readers). */
export function activitySentence(parts: Pick<ActivityParts, 'actor' | 'verb' | 'label'>): string {
  return parts.label ? `${parts.actor} ${parts.verb}: ${parts.label}` : `${parts.actor} ${parts.verb}`;
}
