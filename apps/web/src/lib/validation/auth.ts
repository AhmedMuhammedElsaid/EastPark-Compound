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

export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, { error: 'auth.errors.name_too_short' }).max(100),
  phone: z.string().trim().min(7, { error: 'auth.errors.invalid_phone' }).max(20),
  unitNumber: z.string().trim().min(1, { error: 'auth.errors.unit_required' }).max(50),
  password: z.string().regex(PASSWORD_PATTERN, { error: 'auth.errors.password_weak' }),
});

export const registerFormSchema = registerSchema
  .extend({ confirmPassword: z.string().min(1) })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'auth.errors.passwords_no_match',
    path: ['confirmPassword'],
  });

export const verifyOtpSchema = z.object({
  email: z.email({ error: 'auth.errors.invalid_email' }),
  otp: z.string().regex(/^\d{6}$/, { error: 'auth.errors.invalid_otp' }),
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

export const acceptInvitationSchema = resetPasswordSchema.extend({
  name: z.string().trim().min(2, { error: 'auth.errors.name_too_short' }).max(100),
});

export const acceptInvitationFormSchema = acceptInvitationSchema
  .omit({ token: true })
  .extend({ confirmPassword: z.string().min(1) })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'auth.errors.passwords_no_match',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterFormInput = z.infer<typeof registerFormSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>;
export type AcceptInvitationFormInput = z.infer<typeof acceptInvitationFormSchema>;