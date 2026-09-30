import { z } from 'zod';

export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

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

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterFormInput = z.infer<typeof registerFormSchema>;