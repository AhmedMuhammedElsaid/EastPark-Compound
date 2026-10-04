/**
 * Fixed list of admin activity actions (shared contract with web/mobile).
 * Clients render unknown actions generically, so adding one is safe; renaming
 * one breaks the readable feed for rows already written.
 */
export const AUDIT_ACTIONS = [
    'LEAD_APPROVED',
    'LEAD_REJECTED',
    'INVITATION_SENT',
    'USER_DELETED',
    'USER_ROLE_CHANGED',
    'ANNOUNCEMENT_CREATED',
    'ANNOUNCEMENT_UPDATED',
    'ANNOUNCEMENT_DELETED',
    'COMMENT_CREATED',
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
    'SHOP_PHOTO_ADDED',
    'SHOP_PHOTO_DELETED',
    'PRODUCT_CREATED',
    'PRODUCT_UPDATED',
    'PRODUCT_DELETED',
    'ORDER_STATUS_CHANGED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntity =
    | 'ResidentLead'
    | 'Invitation'
    | 'User'
    | 'Announcement'
    | 'Comment'
    | 'Poll'
    | 'Election'
    | 'Report'
    | 'Feedback'
    | 'Shop'
    | 'Product'
    | 'Order';

/**
 * `label` is always a short, human-readable target ("Pool closed Friday",
 * "Sara (sara@x.com)"). Never put a national id, passport or phone here.
 */
export interface AuditMeta {
    label: string;
    [key: string]: string | number | boolean | null;
}
