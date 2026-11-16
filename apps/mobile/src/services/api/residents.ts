import type { toLeadPayload } from "@/lib/register-unit";

import { client } from "./client";

export type LeadPayload = ReturnType<typeof toLeadPayload>;
export type LeadError = "network" | "duplicate" | "rate_limited" | "validation" | "server";
export type LeadResult = { ok: true } | { ok: false; error: LeadError };

function errorFor(err: unknown): LeadError {
  const status = (err as { response?: { status?: number } } | null)?.response?.status;
  if (status === undefined)
    return "network";
  if (status === 409)
    return "duplicate";
  if (status === 429)
    return "rate_limited";
  if (status === 400 || status === 422)
    return "validation";
  return "server";
}

export const residentsApi = {
  /** Public, throttled (5/min/IP): a guest submits their unit for admin approval. */
  async submitLead(payload: LeadPayload): Promise<LeadResult> {
    try {
      await client.post("/residents/leads", payload);
      return { ok: true };
    }
    catch (err) {
      return { ok: false, error: errorFor(err) };
    }
  },
};
