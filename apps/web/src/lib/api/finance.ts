import type { z } from 'zod';

import {
  applyCreditResultSchema,
  attachmentUploadSchema,
  auditPageSchema,
  chargeSchema,
  flatDetailSchema,
  flatPageSchema,
  IDEMPOTENCY_HEADER,
  ownershipListSchema,
  paymentDetailSchema,
  paymentPageSchema,
  paymentResultSchema,
  periodListSchema,
  type ApplyCreditInput,
  type ChargeCreateInput,
  type PaymentCreateInput,
} from '@/lib/finance/schemas';

/**
 * Browser client for the finance BFF (`/api/finance/*`). Never cached and never persisted: every
 * call is `no-store`, and nothing here touches storage. Errors carry only the BFF code.
 */
export class FinanceApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = 'FinanceApiError';
  }
}

const TIMEOUT_MS = 30_000;

async function request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/finance${path}`, {
      ...init,
      headers: { ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
      cache: 'no-store',
      credentials: 'same-origin',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new FinanceApiError('network', 0);
  }
  const payload = (await response.json().catch(() => null)) as { data?: unknown; error?: unknown } | null;
  if (!response.ok) {
    throw new FinanceApiError(typeof payload?.error === 'string' ? payload.error : 'request_failed', response.status);
  }
  const parsed = schema.safeParse(payload?.data);
  if (!parsed.success) throw new FinanceApiError('contract', response.status);
  return parsed.data;
}

export function financeQuery(values: Record<string, string | number | boolean | undefined | null>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  const result = query.toString();
  return result ? `?${result}` : '';
}

const id = encodeURIComponent;

export type FlatsQuery = {
  cursor?: string;
  limit?: number;
  q?: string;
  building?: string;
  phase?: string;
  hasBalance?: boolean;
  overdueDays?: number;
};

export type PaymentsQuery = {
  cursor?: string;
  limit?: number;
  flatId?: string;
  method?: string;
  status?: string;
  chequeState?: string;
  from?: string;
  to?: string;
  q?: string;
};

export type AuditQuery = { cursor?: string; limit?: number; action?: string; entity?: string; entityId?: string; from?: string; to?: string };

export const financeApi = {
  flats: (query: FlatsQuery = {}) => request(`/flats${financeQuery(query)}`, flatPageSchema),
  flat: (flatId: string) => request(`/flats/${id(flatId)}`, flatDetailSchema),
  ownership: (flatId: string) => request(`/flats/${id(flatId)}/ownership`, ownershipListSchema),
  applyCredit: (flatId: string, input: ApplyCreditInput) =>
    request(`/flats/${id(flatId)}/apply-credit`, applyCreditResultSchema, { method: 'POST', body: JSON.stringify(input) }),
  createCharge: (input: ChargeCreateInput) => request('/charges', chargeSchema, { method: 'POST', body: JSON.stringify(input) }),
  voidCharge: (chargeId: string, reason: string) =>
    request(`/charges/${id(chargeId)}/void`, chargeSchema, { method: 'POST', body: JSON.stringify({ reason }) }),
  payments: (query: PaymentsQuery = {}) => request(`/payments${financeQuery(query)}`, paymentPageSchema),
  payment: (paymentId: string) => request(`/payments/${id(paymentId)}`, paymentDetailSchema),
  /** `key` must be the SAME on a retry of the same submission (see `PaymentSubmission`). */
  recordPayment: (input: PaymentCreateInput, key: string) =>
    request('/payments', paymentResultSchema, {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: key },
      body: JSON.stringify(input),
    }),
  voidPayment: (paymentId: string, reason: string) =>
    request(`/payments/${id(paymentId)}/void`, paymentDetailSchema, { method: 'POST', body: JSON.stringify({ reason }) }),
  chequeCleared: (paymentId: string, date?: string) =>
    request(`/payments/${id(paymentId)}/cheque-cleared`, paymentDetailSchema, { method: 'POST', body: JSON.stringify({ date }) }),
  chequeBounced: (paymentId: string, date?: string) =>
    request(`/payments/${id(paymentId)}/cheque-bounced`, paymentDetailSchema, { method: 'POST', body: JSON.stringify({ date }) }),
  audit: (query: AuditQuery = {}) => request(`/audit${financeQuery(query)}`, auditPageSchema),
  periods: () => request('/periods', periodListSchema),
  uploadSlip: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request('/attachments', attachmentUploadSchema, { method: 'POST', body });
  },
};

/** Opens a payment's private slip: the BFF answers with a one-off 302 to a 60-second signed URL. */
export function slipViewHref(paymentId: string): string {
  return `/api/finance/attachments/view?paymentId=${id(paymentId)}`;
}
