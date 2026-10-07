import { z } from 'zod';

export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[\x21-\x7E]{8,}$/;
export const AUTH_TOKEN_PATTERN = /^[a-f\d]{64}$/i;

export function getPasswordRequirements(password: string) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z\d\s]/.test(password),
    characters: /^[\x21-\x7E]*$/.test(password),
  };
}

export const loginSchema = z.object({
  email: z.email({ error: 'auth.errors.invalid_email' }),
  password: z.string().min(1, { error: 'auth.errors.password_required' }),
});

export const forgotPasswordSchema = z.object({
  email: z.email({ error: 'auth.errors.invalid_email' }),
});

export const resetPasswordSchema = z.object({
  token: z.string().regex(AUTH_TOKEN_PATTERN),
  password: z.string().regex(PASSWORD_PATTERN, { error: 'auth.errors.password_weak' }),
});

export const resetPasswordFormSchema = resetPasswordSchema
  .omit({ token: true })
  .extend({ confirmPassword: z.string().min(1) })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'auth.errors.passwords_no_match',
    path: ['confirmPassword'],
  });

/** Mirrors the backend AcceptInvitationDto password bound (ACCEPT_INVITATION_PASSWORD_MAX). */
export const ACCEPT_INVITATION_PASSWORD_MAX = 256;

/**
 * Shape only for the password: when the invited email already has an account it holds that account's
 * CURRENT password, which may predate today's rules. Nobody can tell the two cases apart up front, so
 * the backend applies PASSWORD_PATTERN only when it creates a new account (400, mapped to
 * `password_weak` by the BFF). The form keeps the requirement checklist as guidance.
 */
export const acceptInvitationSchema = z.object({
  token: z.string().regex(AUTH_TOKEN_PATTERN),
  name: z.string().trim().min(2, { error: 'auth.errors.name_too_short' }).max(100),
  password: z
    .string()
    .min(1, { error: 'auth.errors.password_required' })
    .max(ACCEPT_INVITATION_PASSWORD_MAX, { error: 'auth.errors.password_too_long' }),
});

export const acceptInvitationFormSchema = acceptInvitationSchema
  .omit({ token: true })
  .extend({ confirmPassword: z.string().min(1) })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'auth.errors.passwords_no_match',
    path: ['confirmPassword'],
  });

/** Copy key for a failed accept-invitation BFF response (`{ error }` code). */
export function acceptInvitationErrorKey(error: string | undefined): string {
  switch (error) {
    case 'invalid_invitation':
      return 'auth.invitation_invalid';
    case 'account_deleted':
      // Never the "enter your current password" hint: no password helps a deleted account.
      return 'auth.errors.invitation_account_deleted';
    case 'account_exists':
      return 'auth.errors.invitation_account_exists';
    case 'password_weak':
      // Only a NEW account is held to the password rules (an existing owner's password is just matched).
      return 'auth.errors.invitation_password_weak';
    case 'unit_already_owned':
      return 'auth.errors.invitation_unit_owned';
    case 'rate_limited':
      return 'auth.errors.rate_limited';
    default:
      return 'errors.server';
  }
}

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>;
export type AcceptInvitationFormInput = z.infer<typeof acceptInvitationFormSchema>;