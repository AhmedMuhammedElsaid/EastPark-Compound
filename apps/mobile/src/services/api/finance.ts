import type { AxiosResponse } from "axios";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { client } from "./client";

/**
 * Finance desk (ACCOUNTANT, ADMIN, SUPER_ADMIN). Typed to
 * apps/backend/src/modules/finance/dtos — keep the two in step.
 *
 * Money screens are online-only: these query roots are never in
 * PERSISTED_QUERY_ROOTS and every query drops its cache as soon as the screen
 * unmounts (`gcTime: 0`), so a stale balance is never shown. Amounts arrive
 * as JSON numbers (2 dp) and are SENT as decimal strings.
 */
export type FinancePaymentMethod = "CASH" | "BANK_TRANSFER" | "INSTAPAY" | "CHEQUE";
export const FINANCE_PAYMENT_METHODS: readonly FinancePaymentMethod[] = ["CASH", "BANK_TRANSFER", "INSTAPAY", "CHEQUE"];

export type ChargeKind = "SERVICE_CHARGE" | "MAINTENANCE_DEPOSIT" | "SHORTFALL" | "SERVICE_FEE" | "OPENING_BALANCE" | "OTHER";
export type PostingStatus = "POSTED" | "VOID";
export type ChequeState = "NOT_APPLICABLE" | "PENDING_CLEARANCE" | "CLEARED" | "BOUNCED";
export type PayFor = "AUTO" | "DEPOSIT";

export type FinanceFlatTotals = {
  /** Owed; negative means the flat is in credit. */
  balance: number;
  credit: number;
  availableCredit: number;
  overdueAmount: number;
  oldestDueDays: number | null;
};

export type FinanceFlatListItem = FinanceFlatTotals & {
  id: string;
  label: string;
  building: string;
  floor: string;
  flatNumber: string;
  phase: string;
  isActive: boolean;
  ownerName: string | null;
  hasAccount: boolean;
};

export type FinanceOpenCharge = {
  id: string;
  kind: ChargeKind;
  description: string;
  descriptionAr: string;
  accrualPeriod: string;
  dueDate: string;
  amount: number;
  openAmount: number;
};

export type FinanceFlatDetail = FinanceFlatTotals & {
  id: string;
  label: string;
  building: string;
  floor: string;
  flatNumber: string;
  phase: string;
  isActive: boolean;
  asOf: string;
  openAmount: number;
  owner: { userId: string; name: string; phone: string | null; since: string } | null;
  openCharges: FinanceOpenCharge[];
};

export type FinancePerson = { id: string; name: string };

export type FinanceAllocation = {
  id: string;
  paymentId: string;
  receiptNo: string;
  chargeId: string;
  chargeKind: ChargeKind;
  chargeDescription: string;
  chargeDescriptionAr: string;
  accrualPeriod: string;
  dueDate: string;
  amount: number;
  allocatedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
};

export type FinancePayment = {
  id: string;
  receiptNo: string;
  flatId: string;
  flatLabel: string;
  amount: number;
  method: FinancePaymentMethod;
  reference: string | null;
  chequeState: ChequeState;
  clearedAt: string | null;
  bouncedAt: string | null;
  receivedAt: string;
  payerName: string | null;
  note: string | null;
  status: PostingStatus;
  isOpening: boolean;
  hasAttachment: boolean;
  replacesId: string | null;
  allocatedAmount: number;
  unallocatedAmount: number;
  createdBy: FinancePerson;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  voidedBy: FinancePerson | null;
};

export type FinancePaymentResult = FinancePayment & {
  allocations: FinanceAllocation[];
  asOf: string;
  flatTotals: FinanceFlatTotals;
};

export type FinanceApplyCreditResult = {
  flatId: string;
  flatLabel: string;
  applied: number;
  allocations: FinanceAllocation[];
  asOf: string;
  flatTotals: FinanceFlatTotals;
};

/** `POST /finance/payments` body. `amount` is a decimal string such as "450.00". */
export type FinancePaymentInput = {
  flatId: string;
  amount: string;
  method: FinancePaymentMethod;
  receivedAt: string;
  reference?: string;
  payerName?: string;
  note?: string;
  attachmentPath?: string;
  payFor?: PayFor;
  /** Post despite a `duplicateReference` warning. Not part of the server's request hash. */
  force?: boolean;
};

export type FinanceFlatsParams = {
  q?: string;
  building?: string;
  hasBalance?: boolean;
  overdueDays?: number;
  cursor?: string;
  limit?: number;
};

export type FinancePaymentsParams = {
  flatId?: string;
  status?: PostingStatus;
  from?: string;
  to?: string;
  q?: string;
  cursor?: string;
  limit?: number;
};

export type FinanceFlatPage = { asOf: string; items: FinanceFlatListItem[]; nextCursor?: string | null };
export type FinancePaymentPage = { items: FinancePayment[]; nextCursor?: string | null };
type Envelope<T> = { data: T };

export const IDEMPOTENCY_HEADER = "Idempotency-Key";

const id$ = (id: string) => encodeURIComponent(id);
const IMAGE_EXT = /\.(?:jpe?g|png|webp)$/i;

function slipFileName(uri: string, mime: string): string {
  const last = uri.split("?")[0].split("/").pop() ?? "";
  if (IMAGE_EXT.test(last))
    return last;
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return `slip-${Date.now()}.${ext}`;
}

export const financeApi = {
  flats: (params: FinanceFlatsParams) =>
    client.get<Envelope<FinanceFlatPage>>("/finance/flats", { params }),

  flat: (id: string) => client.get<Envelope<FinanceFlatDetail>>(`/finance/flats/${id$(id)}`),

  payments: (params: FinancePaymentsParams) =>
    client.get<Envelope<FinancePaymentPage>>("/finance/payments", { params }),

  /** The SAME key must be re-sent on a retry: the server then returns the original receipt. */
  createPayment: (body: FinancePaymentInput, idempotencyKey: string) =>
    client.post<Envelope<FinancePaymentResult>>("/finance/payments", body, {
      headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
    }),

  /** `expectedCredit` = the `availableCredit` on screen, as a decimal string (409 `creditChanged` otherwise). */
  applyCredit: (flatId: string, expectedCredit: string) =>
    client.post<Envelope<FinanceApplyCreditResult>>(`/finance/flats/${id$(flatId)}/apply-credit`, { expectedCredit }),

  /** Private slip upload (multipart, any field name). Resolves to the storage path, never a URL. */
  async uploadSlip(uri: string, mime: string): Promise<string> {
    const form = new FormData();
    // React Native's FormData accepts { uri, name, type } in place of a Blob.
    form.append("file", { uri, name: slipFileName(uri, mime), type: mime } as unknown as Blob);
    const res = await client.post<Envelope<{ path: string }>>("/finance/attachments", form, {
      headers: { "Content-Type": "multipart/form-data" },
      transformRequest: (data: unknown) => data,
    });
    return res.data.data.path;
  },
};

/** Query keys. The `finance` root must never be added to PERSISTED_QUERY_ROOTS. */
export const financeKeys = {
  all: ["finance"] as const,
  flats: (params: Omit<FinanceFlatsParams, "cursor" | "limit">) =>
    ["finance", "flats", params.q ?? "", params.hasBalance ?? "any", params.overdueDays ?? 0] as const,
  flat: (id: string) => ["finance", "flat", id] as const,
  payments: (params: Omit<FinancePaymentsParams, "cursor" | "limit">) =>
    ["finance", "payments", params.flatId ?? "", params.from ?? "", params.to ?? "", params.status ?? ""] as const,
};

/** Never served from cache: refetch on mount, dropped on unmount. */
const MONEY_QUERY = { gcTime: 0, staleTime: 0, refetchOnMount: "always" as const };

type FlatPageResponse = AxiosResponse<Envelope<FinanceFlatPage>>;

export function useFinanceFlats(params: Omit<FinanceFlatsParams, "cursor" | "limit">, options?: { enabled?: boolean; limit?: number }) {
  const limit = options?.limit ?? 20;
  return useInfiniteQuery<FlatPageResponse, Error, { pages: FlatPageResponse[] }, readonly unknown[], string | undefined>({
    queryKey: [...financeKeys.flats(params), limit],
    queryFn: ({ pageParam }) => financeApi.flats({ ...params, cursor: pageParam, limit }),
    getNextPageParam: last => last.data.data.nextCursor ?? undefined,
    initialPageParam: undefined,
    enabled: options?.enabled ?? true,
    ...MONEY_QUERY,
  });
}

export function useFinanceFlat(id: string | undefined) {
  return useQuery({
    queryKey: financeKeys.flat(id ?? ""),
    queryFn: () => financeApi.flat(id as string).then(r => r.data.data),
    enabled: !!id,
    ...MONEY_QUERY,
  });
}

/** One page (up to `limit`) of payments; `hasMore` when the server has further pages. */
export function useFinancePayments(params: Omit<FinancePaymentsParams, "cursor" | "limit">, limit = 20, enabled = true) {
  return useQuery({
    queryKey: [...financeKeys.payments(params), limit],
    queryFn: () => financeApi.payments({ ...params, limit }).then(r => ({
      items: r.data.data.items,
      hasMore: !!r.data.data.nextCursor,
    })),
    enabled,
    ...MONEY_QUERY,
  });
}
