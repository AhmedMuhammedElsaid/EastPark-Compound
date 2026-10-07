/**
 * Admin resident-request helpers (pure). Mirrors the backend rules in
 * ResidentsService and the web admin (`apps/web/src/lib/api/resident-leads.ts`).
 */
import type { LeadStatus, ResidentLead } from "@/services/api/admin";
import { getErrorCode, getErrorStatus, isAccountDeletedError } from "@/lib/api-error";

export type LeadAction = "invite" | "reject";
export type InviteKind = "send" | "resend" | "reinvite" | "attach";

export const ALREADY_REGISTERED_MESSAGE = "residentLead.success.alreadyRegistered";

/**
 * Which actions a lead offers. When the email already has an account,
 * approving adds the flat to it (`attach`) instead of sending an invitation.
 */
export function leadActions(status: LeadStatus, hasAccount = false): { invite: InviteKind | null; reject: boolean } {
  if (status === "CONVERTED")
    return { invite: null, reject: false };
  if (hasAccount)
    return { invite: "attach", reject: status !== "REJECTED" };
  if (status === "PENDING")
    return { invite: "send", reject: true };
  if (status === "INVITED")
    return { invite: "resend", reject: true };
  return { invite: "reinvite", reject: false };
}

/** `E2 · 4 · 5`, the same label the web admin shows. */
export function leadUnitLabel(lead: Pick<ResidentLead, "building" | "floor" | "flatNumber">): string {
  return `${lead.building} · ${lead.floor} · ${lead.flatNumber}`;
}

const NON_DIGITS = /\D/g;
const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06F0;

/** Folds Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits to Latin. */
function foldDigit(char: string): string {
  const code = char.charCodeAt(0);
  for (const zero of [ARABIC_INDIC_ZERO, EXTENDED_ARABIC_INDIC_ZERO]) {
    if (code >= zero && code <= zero + 9)
      return String(code - zero);
  }
  return char;
}

function normalize(value: string): string {
  return Array.from(value, foldDigit).join("").toLocaleLowerCase().trim();
}

/** Client-side search over loaded rows: name, email, unit and phone digits. */
export function leadMatches(lead: ResidentLead, rawQuery: string): boolean {
  const query = normalize(rawQuery);
  if (!query)
    return true;
  const haystack = normalize([lead.name, lead.email, `${lead.building} ${lead.floor} ${lead.flatNumber}`, leadUnitLabel(lead)].join(" "));
  if (haystack.includes(query))
    return true;
  const digits = query.replace(NON_DIGITS, "");
  return digits.length >= 3 && lead.phone.replace(NON_DIGITS, "").includes(digits);
}

/** The lead's status after a successful invite call. */
export function inviteResultStatus(message: string | undefined): LeadStatus {
  return message === ALREADY_REGISTERED_MESSAGE ? "CONVERTED" : "INVITED";
}

/** Toast copy for a failed lead action. */
export function leadErrorKey(action: LeadAction, error: unknown): string {
  const status = getErrorStatus(error);
  if (status === undefined)
    return "errors.unreachable";
  if (isAccountDeletedError(error))
    return "admin.invite_account_deleted";
  if (status === 409) {
    if (action === "reject")
      return "admin_leads.error_already_registered";
    return getErrorCode(error) === "unit.error.alreadyOwned" ? "admin_leads.error_unit_owned" : "admin_leads.error_unit_reserved";
  }
  if (status === 404)
    return "admin_leads.error_not_found";
  if (status === 429)
    return "errors.rate_limited";
  if (status === 403)
    return "errors.forbidden";
  return "common.error";
}
