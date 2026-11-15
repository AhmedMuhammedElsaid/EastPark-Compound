import type { FinanceDashboard } from "@/services/api/finance";

import { num } from "@/components/finance/charts/geometry";
import { formatFinanceDate } from "@/lib/finance";
import { formatCurrency } from "@/lib/format-currency";

/**
 * The finance dashboard's one money adapter (spec rule 3). The API sends decimal STRINGS; they become numbers
 * only here, for display and geometry, never for arithmetic that feeds a figure.
 */
export const parseMoney = num;

/** "12,500 EGP" for a decimal string. */
export function formatMoney(value: string | null | undefined): string {
  return formatCurrency(parseMoney(value));
}

/** `2026-11` as "November 2026" / "نوفمبر ٢٠٢٦". */
export function periodLabel(period: string, language: string): string {
  return formatFinanceDate(`${period}-01`, language, { month: "long", year: "numeric" });
}

export type FlatsDrilldown = { building?: string; hasBalance?: boolean; overdueDays?: number; sort?: "balance"; asOf?: string };

/** `/finance/flats` with the dashboard's drilldown parameters (spec section 3.3). */
export function flatsHref(params: FlatsDrilldown = {}): string {
  const parts: string[] = [];
  if (params.building)
    parts.push(`building=${encodeURIComponent(params.building)}`);
  if (params.hasBalance)
    parts.push("hasBalance=true");
  if (params.overdueDays)
    parts.push(`overdueDays=${params.overdueDays}`);
  if (params.sort)
    parts.push(`sort=${params.sort}`);
  if (params.asOf)
    parts.push(`asOf=${encodeURIComponent(params.asOf)}`);
  return parts.length > 0 ? `/finance/flats?${parts.join("&")}` : "/finance/flats";
}

export type DeltaView = { text: string; direction: "up" | "down" | "flat" | "none" };

/** A "vs last month" chip: magnitude text and direction. `null` shows an em dash. */
export function deltaView(value: string | null | undefined, language: string): DeltaView {
  if (value === null || value === undefined || !Number.isFinite(Number(value)))
    return { text: "—", direction: "none" };
  const n = Number(value);
  const abs = Math.abs(n).toLocaleString(language === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 1 });
  return { text: `${abs}%`, direction: n > 0 ? "up" : n < 0 ? "down" : "flat" };
}

export type AttentionKind = "unapplied" | "over90" | "building" | "cheques" | "period";

export type AttentionItem = {
  kind: AttentionKind;
  tone: "warn" | "err" | "gold" | "info";
  /** i18n params for `finance.dash.attn_<kind>` and `finance.dash.attn_<kind>_detail`. */
  params: Record<string, string | number>;
  href: string;
};

/** The building with the highest outstanding per flat (ties: code) and outstanding > 0. */
export function furthestBehind(d: FinanceDashboard) {
  let best: FinanceDashboard["byBuilding"][number] | null = null;
  let bestRatio = 0;
  const ordered = [...d.byBuilding].sort((a, c) => a.building.localeCompare(c.building, "en", { numeric: true }));
  for (const b of ordered) {
    const value = parseMoney(b.outstanding);
    const ratio = b.totalFlats > 0 ? value / b.totalFlats : 0;
    if (value > 0 && ratio > bestRatio) {
      best = b;
      bestRatio = ratio;
    }
  }
  return best;
}

/** The attention cards of spec section 4.1, in the mockup's order. */
export function deriveAttention(d: FinanceDashboard, language: string): AttentionItem[] {
  const items: AttentionItem[] = [];
  const outstanding = parseMoney(d.outstanding);
  const locale = language === "ar" ? "ar-EG" : "en-US";
  if (d.unapplied.count > 0)
    items.push({ kind: "unapplied", tone: "warn", params: { count: d.unapplied.count, amount: formatMoney(d.unapplied.total) }, href: "/finance/period" });
  const over90 = parseMoney(d.aging.over90);
  if (over90 > 0) {
    const share = outstanding > 0 ? Math.round((over90 / outstanding) * 100) : 0;
    items.push({
      kind: "over90",
      tone: "err",
      params: { amount: formatMoney(d.aging.over90), share: `${share.toLocaleString(locale)}%` },
      href: flatsHref({ hasBalance: true, overdueDays: 91, sort: "balance", asOf: d.asOf }),
    });
  }
  const behind = furthestBehind(d);
  if (behind) {
    items.push({
      kind: "building",
      tone: "gold",
      params: { code: behind.building, amount: formatMoney(behind.outstanding), owing: behind.owingFlats, total: behind.totalFlats },
      href: flatsHref({ building: behind.building, hasBalance: true, sort: "balance", asOf: d.asOf }),
    });
  }
  if (d.pendingCheques.count > 0)
    items.push({ kind: "cheques", tone: "info", params: { count: d.pendingCheques.count, amount: formatMoney(d.pendingCheques.total) }, href: "/finance/period" });
  else
    items.push({ kind: "period", tone: "info", params: { period: periodLabel(d.period.period, language), status: d.period.status }, href: "/finance/period" });
  return items;
}

export type CheckKey = "period_not_open" | "preview_runs" | "no_charges" | "unapplied" | "cheques";
export type CheckItem = { key: CheckKey; ok: boolean; strong: boolean; count?: number; href?: string };

/** The advisory period checklist of spec section 4.1 (never `fail`; strong warnings first). */
export function deriveChecks(d: FinanceDashboard): CheckItem[] {
  const preview = d.checks.previewBillingRuns + d.checks.previewImportBatches;
  const checks: CheckItem[] = [
    { key: "period_not_open", ok: d.period.status === "OPEN", strong: true },
    { key: "preview_runs", ok: preview === 0, strong: true, count: preview },
    { key: "no_charges", ok: d.checks.operatingChargesInMonth > 0, strong: false, href: "/finance/flats" },
    { key: "unapplied", ok: d.unapplied.count === 0, strong: false, count: d.unapplied.count },
    { key: "cheques", ok: d.pendingCheques.count === 0, strong: false, count: d.pendingCheques.count },
  ];
  const rank = (c: CheckItem) => (c.ok ? 2 : c.strong ? 0 : 1);
  return checks
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map(x => x.c);
}

/** Every finance audit action the backend can emit (27); each has copy under `finance.dash.audit.*`. */
export const FINANCE_AUDIT_ACTIONS = [
  "PAYMENT_RECORDED",
  "PAYMENT_VOIDED",
  "CHEQUE_STATE_CHANGED",
  "CHARGE_CREATED",
  "CHARGE_VOIDED",
  "BILLING_RUN_COMMITTED",
  "BILLING_RUN_VOIDED",
  "EXPENSE_CREATED",
  "EXPENSE_APPROVED",
  "EXPENSE_REJECTED",
  "EXPENSE_VOIDED",
  "REVENUE_RECORDED",
  "REVENUE_VOIDED",
  "FUND_ENTRY_RECORDED",
  "FUND_ENTRY_VOIDED",
  "FUND_ADJUSTED",
  "PERIOD_CLOSED",
  "PERIOD_REOPENED",
  "FINANCE_SETTING_CHANGED",
  "OPENING_BALANCES_IMPORTED",
  "OPENING_BALANCES_VOIDED",
  "REPORT_PUBLISHED",
  "REPORT_WITHDRAWN",
  "FINANCE_EXPORT",
  "ATTACHMENT_VIEWED",
  "FLAT_OWNERSHIP_CHANGED",
  "CREDIT_APPLIED",
] as const;

/** Translation key for an audit action; an unmapped action gets the generic label, never the raw code. */
export function auditLabelKey(action: string): string {
  return (FINANCE_AUDIT_ACTIONS as readonly string[]).includes(action) ? `finance.dash.audit.${action}` : "finance.dash.audit_generic";
}

/** Cairo clock time of an ISO instant ("14:20"); empty when the engine has no time zone data. */
export function formatCairoTime(iso: string, language: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()))
    return "";
  try {
    return date.toLocaleTimeString(language === "ar" ? "ar-EG" : "en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false });
  }
  catch {
    return "";
  }
}

/** Cairo date and time of an ISO instant ("15 Nov, 14:20") for the timeline; empty without time zone data. */
export function formatCairoStamp(iso: string, language: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()))
    return "";
  try {
    return date.toLocaleString(language === "ar" ? "ar-EG" : "en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  }
  catch {
    return "";
  }
}
