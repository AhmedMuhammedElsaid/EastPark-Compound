import { z } from 'zod';

const optionalPhone = z.union([
  z.literal(''),
  z.string().regex(/^\+[1-9]\d{7,14}$/, 'profile.errors.phone'),
]);

const optionalUrl = z.union([
  z.literal(''),
  z.url({ error: 'profile.errors.avatar_url' }),
]);

export const profileFormSchema = z.object({
  name: z.string().trim().min(2, 'profile.errors.name').max(100, 'profile.errors.name'),
  phone: optionalPhone,
  unitNumber: z.string().trim().max(100, 'profile.errors.unit'),
  avatarUrl: optionalUrl,
});

export type ProfileFormInput = z.infer<typeof profileFormSchema>;

export function toProfileUpdate(input: ProfileFormInput) {
  return {
    name: input.name.trim(),
    phone: input.phone || null,
    unitNumber: input.unitNumber.trim() || null,
    avatarUrl: input.avatarUrl || null,
  };
}