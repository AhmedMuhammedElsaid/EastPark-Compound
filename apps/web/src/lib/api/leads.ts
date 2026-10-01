/**
 * Client for the same-origin resident-registration proxy. The Next route
 * forwards to POST /v1/residents/leads, avoiding browser CORS dependencies.
 *
 * Every value goes over the wire as a STRING, including floor ("G" or "1".."11")
 * and flatNumber ("1".."5"). The backend columns are String precisely so a
 * ground floor can be represented; do not "helpfully" send numbers.
 */

export type LeadPayload = {
  name: string;
  email: string;
  phone: string;
  building: string;
  floor: string;
  flatNumber: string;
  /** Omitted entirely when blank — sending "" would overwrite a stored value. */
  parking?: string;
  jobTitle?: string;
  maritalStatus?: 'MARRIED' | 'SINGLE' | 'DIVORCED';
};

/** Discriminates the failure so the UI can show a specific, honest message. */
export type LeadError =
  | 'network'
  | 'timeout'
  | 'duplicate'
  | 'rate_limited'
  | 'validation'
  | 'server';

export type LeadResult = { ok: true } | { ok: false; error: LeadError };

const TIMEOUT_MS = 22_000;
const RESIDENT_LEADS_URL = '/api/resident-leads';

export async function submitLead(payload: LeadPayload): Promise<LeadResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(RESIDENT_LEADS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // The controller currently returns 200 for a successful create. Accept any
    // 2xx so this client is not coupled to that response-code detail.
    if (response.ok) {
      return { ok: true };
    }

    if (response.status === 429) return { ok: false, error: 'rate_limited' };
    // A unit with an active lead is reserved, regardless of which contact
    // details were submitted for it.
    if (response.status === 409) return { ok: false, error: 'duplicate' };
    if (response.status === 400 || response.status === 422) {
      return { ok: false, error: 'validation' };
    }

    // Everything else, including a 404 while the endpoint is still being
    // built, becomes the generic server message. Never leak "Not Found" or a
    // stack trace to a resident.
    return { ok: false, error: 'server' };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, error: 'timeout' };
    }
    // fetch() rejects on DNS failure, offline, and CORS rejection alike.
    return { ok: false, error: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
