import { z } from 'zod';

/**
 * Finance desk contracts (backend `/v1/finance/*`). Request schemas are what the BFF lets through
 * (unknown keys are stripped); response schemas are what the desk UI parses. Money goes out as a
 * decimal STRING (the backend's canonical form) and comes back as a 2-dp JSON number.
 */

export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'INSTAPAY', 'CHEQUE'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CHARGE_KINDS = ['SERVICE_CHARGE', 'MAINTENANCE_DEPOSIT', 'SHORTFALL', 'SERVICE_FEE', 'OPENING_BALANCE', 'OTHER'] as const;
export type ChargeKind = (typeof CHARGE_KINDS)[number];
/** Kinds a person may post by hand (OPENING_BALANCE comes only from the import). */
export const MANUAL_CHARGE_KINDS = ['SERVICE_CHARGE', 'MAINTENANCE_DEPOSIT', 'SHORTFALL', 'SERVICE_FEE', 'OTHER'] as const;

export const CHEQUE_STATES = ['NOT_APPLICABLE', 'PENDING_CLEARANCE', 'CLEARED', 'BOUNCED'] as const;
export const POSTING_STATUSES = ['POSTED', 'VOID'] as const;
export const PAY_FOR = ['AUTO', 'DEPOSIT'] as const;
export type PayFor = (typeof PAY_FOR)[number];
export const MAX_ALLOCATIONS = 50;
export const VOID_REASON_MIN = 5;

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
  'CREDIT_APPLIED',
] as const;

/** Header carrying the client-generated payment key (backend: 8-100 of `[A-Za-z0-9_-]`). */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

// ---- request (BFF) -------------------------------------------------------------------------

/** Flat, charge and payment ids (`flat_A1-3-2`, cuids). */
export const financeIdSchema = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/);
/** Plain decimal string; the backend owns precision and range (its errors carry the reason). */
export const decimalStringSchema = z.string().trim().regex(/^\d{1,12}(\.\d{1,6})?$/);
export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const periodSchema = z.string().regex(/^\d{4}-\d{2}$/);
const text = (max: number) => z.string().trim().min(1).max(max);

const allocationInputSchema = z.object({ chargeId: financeIdSchema, amount: decimalStringSchema });
const allocationsSchema = z.array(allocationInputSchema).min(1).max(MAX_ALLOCATIONS);

export const chargeCreateSchema = z.object({
  flatId: financeIdSchema,
  kind: z.enum(MANUAL_CHARGE_KINDS),
  amount: decimalStringSchema,
  description: text(300),
  descriptionAr: text(300),
  dueDate: dateOnlySchema,
  accrualPeriod: periodSchema.optional(),
  replacesId: financeIdSchema.optional(),
});
export type ChargeCreateInput = z.infer<typeof chargeCreateSchema>;

export const voidSchema = z.object({ reason: z.string().trim().min(VOID_REASON_MIN).max(500) });

export const paymentCreateSchema = z.object({
  flatId: financeIdSchema,
  amount: decimalStringSchema,
  method: z.enum(PAYMENT_METHODS),
  reference: text(100).optional(),
  receivedAt: dateOnlySchema,
  payerName: text(120).optional(),
  note: text(500).optional(),
  attachmentPath: z.string().min(1).max(300).optional(),
  allocations: allocationsSchema.optional(),
  payFor: z.enum(PAY_FOR).optional(),
  force: z.boolean().optional(),
  replacesId: financeIdSchema.optional(),
});
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;

export const chequeDateSchema = z.object({ date: dateOnlySchema.optional() });

export const applyCreditSchema = z.object({
  expectedCredit: decimalStringSchema,
  allocations: allocationsSchema.optional(),
  payFor: z.enum(PAY_FOR).optional(),
  amount: decimalStringSchema.optional(),
});
export type ApplyCreditInput = z.infer<typeof applyCreditSchema>;

const cursorLimit = {
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

export const flatsQuerySchema = z.object({
  ...cursorLimit,
  q: z.string().trim().min(1).max(20).optional(),
  building: z.string().trim().min(1).max(10).optional(),
  phase: z.string().trim().min(1).max(20).optional(),
  hasBalance: z.enum(['true', 'false']).optional(),
  overdueDays: z.coerce.number().int().min(1).max(36500).optional(),
  asOf: dateOnlySchema.optional(),
});

export const asOfQuerySchema = z.object({ asOf: dateOnlySchema.optional() });

export const paymentsQuerySchema = z.object({
  ...cursorLimit,
  flatId: financeIdSchema.optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  status: z.enum(POSTING_STATUSES).optional(),
  chequeState: z.enum(CHEQUE_STATES).optional(),
  createdById: financeIdSchema.optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export const auditQuerySchema = z.object({
  ...cursorLimit,
  entity: z.string().trim().min(1).max(40).optional(),
  entityId: z.string().trim().min(1).max(64).optional(),
  action: z.enum(FINANCE_AUDIT_ACTIONS).optional(),
  actorId: financeIdSchema.optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

export const periodsQuerySchema = z.object({ from: periodSchema.optional(), to: periodSchema.optional() });

export const emptyQuerySchema = z.object({});

// ---- responses (desk UI) -------------------------------------------------------------------

const money = z.number();
const person = z.object({ id: z.string(), name: z.string() });

const flatTotals = {
  balance: money,
  credit: money,
  availableCredit: money,
  overdueAmount: money,
  oldestDueDays: z.number().nullable(),
};
export const flatTotalsSchema = z.object(flatTotals);
export type FlatTotals = z.infer<typeof flatTotalsSchema>;

const flatIdentity = {
  id: z.string(),
  label: z.string(),
  building: z.string(),
  floor: z.string(),
  flatNumber: z.string(),
  phase: z.string(),
  isActive: z.boolean(),
};

export const flatListItemSchema = z.object({
  ...flatTotals,
  ...flatIdentity,
  ownerName: z.string().nullable(),
  hasAccount: z.boolean(),
});
export type FlatListItem = z.infer<typeof flatListItemSchema>;

export const flatPageSchema = z.object({
  asOf: z.string(),
  items: z.array(flatListItemSchema),
  nextCursor: z.string().nullish(),
});

export const openChargeSchema = z.object({
  id: z.string(),
  kind: z.enum(CHARGE_KINDS),
  descriptionAr: z.string(),
  accrualPeriod: z.string(),
  dueDate: z.string(),
  amount: money,
  openAmount: money,
});
export type OpenCharge = z.infer<typeof openChargeSchema>;

export const flatDetailSchema = z.object({
  ...flatTotals,
  ...flatIdentity,
  asOf: z.string(),
  openAmount: money,
  owner: z
    .object({ userId: z.string(), name: z.string(), phone: z.string().nullable(), since: z.string() })
    .nullable(),
  openCharges: z.array(openChargeSchema),
});
export type FlatDetail = z.infer<typeof flatDetailSchema>;

export const ownershipListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      ownerName: z.string().nullable(),
      ownerDeleted: z.boolean(),
      fromDate: z.string(),
      beforeGoLive: z.boolean(),
      toDate: z.string().nullable(),
      closedReason: z.enum(['SOLD', 'REMOVED', 'ACCOUNT_DELETED']).nullable(),
    }),
  ),
});
export type OwnershipItem = z.infer<typeof ownershipListSchema>['items'][number];

export const chargeSchema = z.object({
  id: z.string(),
  flatId: z.string(),
  flatLabel: z.string(),
  kind: z.enum(CHARGE_KINDS),
  amount: money,
  descriptionAr: z.string(),
  accrualPeriod: z.string(),
  dueDate: z.string(),
  status: z.enum(POSTING_STATUSES),
});

export const allocationSchema = z.object({
  id: z.string(),
  paymentId: z.string(),
  receiptNo: z.string(),
  chargeId: z.string(),
  chargeKind: z.enum(CHARGE_KINDS),
  chargeDescription: z.string(),
  chargeDescriptionAr: z.string(),
  accrualPeriod: z.string(),
  dueDate: z.string(),
  amount: money,
  allocatedAt: z.string(),
  voidedAt: z.string().nullable(),
  voidReason: z.string().nullable(),
});
export type Allocation = z.infer<typeof allocationSchema>;

const paymentFields = {
  id: z.string(),
  receiptNo: z.string(),
  flatId: z.string(),
  flatLabel: z.string(),
  amount: money,
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().nullable(),
  chequeState: z.enum(CHEQUE_STATES),
  clearedAt: z.string().nullable(),
  bouncedAt: z.string().nullable(),
  receivedAt: z.string(),
  payerName: z.string().nullable(),
  note: z.string().nullable(),
  status: z.enum(POSTING_STATUSES),
  isOpening: z.boolean(),
  hasAttachment: z.boolean(),
  replacesId: z.string().nullable(),
  allocatedAmount: money,
  unallocatedAmount: money,
  createdBy: person,
  createdAt: z.string(),
  voidedAt: z.string().nullable(),
  voidReason: z.string().nullable(),
  voidedBy: person.nullable(),
};
export const paymentSchema = z.object(paymentFields);
export type Payment = z.infer<typeof paymentSchema>;

export const paymentPageSchema = z.object({ items: z.array(paymentSchema), nextCursor: z.string().nullish() });

export const paymentDetailSchema = z.object({ ...paymentFields, allocations: z.array(allocationSchema) });
export type PaymentDetail = z.infer<typeof paymentDetailSchema>;

export const paymentResultSchema = paymentDetailSchema.extend({ asOf: z.string(), flatTotals: flatTotalsSchema });
export type PaymentResult = z.infer<typeof paymentResultSchema>;

export const applyCreditResultSchema = z.object({
  flatId: z.string(),
  flatLabel: z.string(),
  applied: money,
  allocations: z.array(allocationSchema),
  asOf: z.string(),
  flatTotals: flatTotalsSchema,
});

export const auditPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      entity: z.string(),
      entityId: z.string().nullable(),
      meta: z.record(z.string(), z.unknown()).nullable(),
      createdAt: z.string(),
      actor: person.extend({ role: z.string() }),
    }),
  ),
  nextCursor: z.string().nullish(),
});
export type AuditItem = z.infer<typeof auditPageSchema>['items'][number];

export const periodListSchema = z.object({
  items: z.array(
    z.object({
      period: z.string(),
      status: z.enum(['OPEN', 'CLOSED']),
      closedAt: z.string().nullable(),
    }),
  ),
});

export const attachmentUploadSchema = z.object({ path: z.string().min(1) });
