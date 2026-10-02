import { z } from "zod";

/**
 * Mirrors the backend PASSWORD_REGEX
 * (apps/backend/src/common/auth/dtos/request/auth.dto.ts): 8+ printable ASCII
 * characters (no spaces, no Arabic letters) with at least one lowercase,
 * uppercase, digit and special character. Keep the two in sync.
 */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[\x21-\x7E]{8,}$/;

/** zod schema for any NEW password (register, reset, accept-invitation). Messages are i18n keys. */
export const newPasswordSchema = z
  .string()
  .min(8, "auth.errors.password_too_short")
  .regex(PASSWORD_REGEX, "auth.errors.password_requirements");
