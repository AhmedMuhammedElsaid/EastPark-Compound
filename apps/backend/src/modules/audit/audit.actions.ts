/**
 * Finance actions (accounting plan 3.7), written only by `FinanceAuditService`
 * inside the posting transaction. `GET /admin/activity` hides them unless
 * `scope=finance|all`; the full trail is `GET /finance/audit`.
 */
export const FINANCE_AUDIT_ACTIONS = [
    'PAYMENT_RECORDED',
    'PAYMENT_VOIDED',
    'CHEQUE_STATE_CHANGED',
    'CHARGE_CREATED',
    'CHARGE_VOIDED',
    'BILLING_RUN_COMMITTED',
    'BILLING_RUN_VOIDED',
    'EXPENSE_CREATED',
    'EXPENSE_APPROVED',
    'EXPENSE_REJECTED',
    'EXPENSE_VOIDED',
    'REVENUE_RECORDED',
    'REVENUE_VOIDED',
    'FUND_ENTRY_RECORDED',
    'FUND_ENTRY_VOIDED',
    'FUND_ADJUSTED',
    'PERIOD_CLOSED',
    'PERIOD_REOPENED',
    'FINANCE_SETTING_CHANGED',
    'OPENING_BALANCES_IMPORTED',
    'OPENING_BALANCES_VOIDED',
    'REPORT_PUBLISHED',
    'REPORT_WITHDRAWN',
    'FINANCE_EXPORT',
    'ATTACHMENT_VIEWED',
    'FLAT_OWNERSHIP_CHANGED',
    // Slice 7: credit applied to open charges (POST /finance/flats/:id/apply-credit)
    'CREDIT_APPLIED',
] as const;

export type FinanceAuditAction = (typeof FINANCE_AUDIT_ACTIONS)[number];

/** Finance audit entities (the `audit_logs.entity` column). */
export type FinanceAuditEntity =
    | 'Charge'
    | 'Payment'
    | 'PaymentAllocation'
    | 'BillingRun'
    | 'Expense'
    | 'Revenue'
    | 'FundEntry'
    | 'FiscalPeriod'
    | 'FinanceSetting'
    | 'ImportBatch'
    | 'PublishedReport'
    | 'Flat'
    | 'FlatOwnership';

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
    'REVIEW_DELETED',
    // Recycle bin (SUPER_ADMIN restores a soft-deleted record)
    'USER_RESTORED',
    'SHOP_RESTORED',
    'SHOP_PHOTO_RESTORED',
    'PRODUCT_RESTORED',
    'REVIEW_RESTORED',
    // Multi-flat owners (SUPER_ADMIN adds / removes a flat on an account)
    'UNIT_ADDED',
    'UNIT_REMOVED',
    // Accounting slice 3: audited key repairs (SUPER_ADMIN unit key, admin lead unit)
    'UNIT_KEY_CHANGED',
    'LEAD_UNIT_CHANGED',
    // Flat listings (admin moderation)
    'LISTING_APPROVED',
    'LISTING_REJECTED',
    'LISTING_TAKEN_DOWN',
    // Accounting (finance desk), hidden from the default activity feed
    ...FINANCE_AUDIT_ACTIONS,
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
    | 'ShopPhoto'
    | 'Product'
    | 'Review'
    | 'Order'
    | 'ResidentUnit'
    | 'Listing';

/**
 * `label` is always a short, human-readable target ("Pool closed Friday",
 * "Sara (sara@x.com)"). Never put a national id, passport or phone here.
 */
export interface AuditMeta {
    label: string;
    [key: string]: string | number | boolean | null;
}
