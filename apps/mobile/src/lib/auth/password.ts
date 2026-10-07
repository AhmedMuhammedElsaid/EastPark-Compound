import { z } from "zod";

/**
 * Mirrors the backend PASSWORD_REGEX
 * (apps/backend/src/common/auth/dtos/request/auth.dto.ts): 8+ printable ASCII
 * characters (no spaces, no Arabic letters) with at least one lowercase,
 * uppercase, digit and special character. Keep the two in sync.
 */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[\x21-\x7E]{8,}$/;

/** zod schema for a NEW password. Messages are i18n keys. */
export const newPasswordSchema = z
  .string()
  .min(8, "auth.errors.password_too_short")
  .regex(PASSWORD_REGEX, "auth.errors.password_requirements");

/** Mirrors the backend ACCEPT_INVITATION_PASSWORD_MAX (AcceptInvitationDto). */
export const INVITATION_PASSWORD_MAX = 256;

/**
 * Accept-invitation password: shape only. When the invited email already has
 * an account this is its CURRENT password, which may predate today's rules,
 * and nobody can tell the two cases apart up front. The backend applies
 * PASSWORD_REGEX only when it creates a new account (a validation 400 that
 * acceptInvitationErrorKey maps to auth.errors.password_requirements).
 */
export const invitationPasswordSchema = z
  .string()
  .min(1, "validation.required")
  .max(INVITATION_PASSWORD_MAX, "auth.errors.password_too_long");
