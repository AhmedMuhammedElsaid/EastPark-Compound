/**
 * Admin resident-lead client helpers. All calls go through the same-origin ADMIN BFF routes under
 * `/api/admin/residents/leads`; the BFF reduces backend errors to `{ error }` codes and keeps the
 * HTTP status, so the UI maps status + action to its own bilingual copy.
 */

export const LEAD_STATUSES = ['PENDING', 'INVITED', 'CONVERTED', 'REJECTED'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadFilter = LeadStatus | 'ALL';
export type MaritalStatus = 'MARRIED' | 'SINGLE' | 'DIVORCED';

export type ResidentLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  building: string;
  floor: string;
  flatNumber: string;
  parking?: string | null;
  jobTitle?: string | null;
  maritalStatus?: MaritalStatus | null;
  nationalId?: string | null;
  passportNumber?: string | null;
  status: LeadStatus;
  createdAt: string;
};

export type LeadStats = Record<LeadStatus, number> & { total: number };
export type LeadAction = 'invite' | 'reject';
export type LeadPage = { items: ResidentLead[]; nextCursor?: string };

/** Error keys under `admin_leads.errors.*`. */
export type LeadErrorKey =
  | 'unit_reserved'
  | 'unit_owned'
  | 'already_registered'
  | 'account_deleted'
  | 'not_found'
  | 'rate_limited'
  | 'session'
  | 'forbidden'
  | 'network'
  | 'generic';

export class LeadRequestError extends Error {
  /** `code` is the BFF `{ error }` code of a failed response, when it sent one. */
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`lead_request_${status}`);
  }
}

/** Which actions a lead in `status` offers. Mirrors the backend rules in ResidentsService. */
export function leadActions(status: LeadStatus): { invite: 'send' | 'resend' | 'reinvite' | null; reject: boolean } {
  switch (status) {
    case 'PENDING':
      return { invite: 'send', reject: true };
    case 'INVITED':
      return { invite: 'resend', reject: true };
    case 'REJECTED':
      return { invite: 'reinvite', reject: false };
    default:
      return { invite: null, reject: false };
  }
}

/**
 * Maps a failed action's HTTP status (and BFF code) to copy. Invite has three conflicts: the email
 * belongs to a deleted account (`account_deleted`), the flat already belongs to another account
 * (`unit_already_owned`), otherwise the unit has a newer active request.
 * Reject has one: the resident already registered.
 */
export function leadErrorKey(action: LeadAction | 'load', status: number, code?: string): LeadErrorKey {
  if (status === 409 && code === 'account_deleted') return 'account_deleted';
  // The flat already belongs to another account (backend `unit.error.alreadyOwned`).
  if (status === 409 && action === 'invite' && code === 'unit_already_owned') return 'unit_owned';
  if (status === 409) return action === 'reject' ? 'already_registered' : 'unit_reserved';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status === 401) return 'session';
  if (status === 403) return 'forbidden';
  if (status === 0 || status === 503) return 'network';
  return 'generic';
}

/** Moves one lead between status buckets; `total` is unchanged. Never goes below zero. */
export function shiftStats(stats: LeadStats | null, from: LeadStatus, to: LeadStatus): LeadStats | null {
  if (!stats || from === to) return stats;
  return { ...stats, [from]: Math.max(0, stats[from] - 1), [to]: stats[to] + 1 };
}

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

/** Lower-cases, folds Arabic-Indic digits to Latin and drops spacing/punctuation in phone-like input. */
export function normalizeSearch(value: string): string {
  return value
    .replace(ARABIC_DIGITS, (digit) => String((digit.charCodeAt(0) & 0xf) % 10))
    .toLocaleLowerCase()
    .trim();
}

export function unitLabel(lead: Pick<ResidentLead, 'building' | 'floor' | 'flatNumber'>): string {
  return `${lead.building} · ${lead.floor} · ${lead.flatNumber}`;
}

/** Client-side search over loaded rows: name, email, phone (digits only) and unit. */
export function leadMatches(lead: ResidentLead, rawQuery: string): boolean {
  const query = normalizeSearch(rawQuery);
  if (!query) return true;
  const digits = query.replace(/[^\d]/g, '');
  const haystack = normalizeSearch(
    [lead.name, lead.email, `${lead.building} ${lead.floor} ${lead.flatNumber}`, unitLabel(lead)].join(' '),
  );
  if (haystack.includes(query)) return true;
  // Phones are matched on digits so "010 0040" and "+2010..." both find "01000400163".
  return digits.length >= 3 && lead.phone.replace(/[^\d]/g, '').includes(digits);
}

/** Masks an identity document number, keeping only the last four characters. */
export function maskIdentifier(value: string): string {
  const visible = value.slice(-4);
  return `${'•'.repeat(Math.max(4, value.length - 4))}${visible}`;
}

type Envelope<T> = { data?: T };

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T | undefined> {
  let response: Response;
  try {
    response = await fetch(path, { cache: 'no-store', ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new LeadRequestError(0);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    throw new LeadRequestError(response.status, typeof body?.error === 'string' ? body.error : undefined);
  }
  const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
  return payload?.data;
}

export async function fetchLeadPage(filter: LeadFilter, cursor?: string): Promise<LeadPage> {
  const params = new URLSearchParams();
  if (filter !== 'ALL') params.set('status', filter);
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  const data = await request<LeadPage>(`/api/admin/residents/leads${query ? `?${query}` : ''}`);
  return { items: data?.items ?? [], nextCursor: data?.nextCursor ?? undefined };
}

export async function fetchLeadStats(): Promise<LeadStats> {
  const data = await request<Partial<LeadStats>>('/api/admin/residents/leads/stats');
  if (!data) throw new LeadRequestError(502);
  const stats = { PENDING: 0, INVITED: 0, CONVERTED: 0, REJECTED: 0, total: 0 } as LeadStats;
  for (const status of LEAD_STATUSES) stats[status] = Number(data[status]) || 0;
  stats.total = Number(data.total) || LEAD_STATUSES.reduce((sum, status) => sum + stats[status], 0);
  return stats;
}

/**
 * Sends (or re-sends) the invitation. Resolves with the lead's resulting status: an email that
 * already has an account is linked and becomes CONVERTED instead of INVITED.
 */
export async function inviteLead(id: string): Promise<LeadStatus> {
  // The BFF allows 25 s for the email + a cold backend; the browser waits a little longer.
  const data = await request<{ message?: string }>(
    `/api/admin/residents/leads/${encodeURIComponent(id)}/invite`,
    { method: 'POST' },
    32_000,
  );
  return data?.message === 'residentLead.success.alreadyRegistered' ? 'CONVERTED' : 'INVITED';
}

export async function rejectLead(id: string): Promise<void> {
  await request(`/api/admin/residents/leads/${encodeURIComponent(id)}/reject`, { method: 'PATCH' }, 32_000);
}
