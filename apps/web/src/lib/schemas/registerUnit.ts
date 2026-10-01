import { z } from 'zod';

import { isValidBuilding, isValidFlat, isValidFloorForBuilding } from '@/config/compound';

/**
 * Validation messages are i18n KEYS, not English strings — they are resolved
 * through t(...) at render time. This mirrors the mobile app's convention
 * (eastpark-frontend/src/app/(auth)/login.tsx:29) and is what lets the same
 * schema produce correct Arabic and English errors.
 *
 * Every field is a string end to end. No z.coerce here: a <select> already
 * yields a string, floor may legitimately be "G", and coercion triggers a
 * known zodResolver input/output generics problem in this project.
 */

// Permissive on purpose. On a public lead form, losing a real resident costs
// more than storing an oddly-formatted number. Matches the backend's Egyptian
// regex, which also strips separators before validating.
const PHONE_PATTERN = /^(?:\+?20|0)1[0125]\d{8}$/;
export const maritalStatuses = ['MARRIED', 'SINGLE', 'DIVORCED'] as const;

export const registerUnitSchema = z
  .object({
    name: z.string().trim().min(2, 'register.errors.name_too_short').max(100),
    email: z.string().trim().min(1, 'register.errors.email_required').email('register.errors.invalid_email'),
    phone: z
      .string()
      .trim()
      .min(1, 'register.errors.phone_required')
      // Strip spaces, hyphens and parens before matching — people paste numbers
      // in whatever shape their contacts app produced.
      .refine((value) => PHONE_PATTERN.test(value.replace(/[\s()-]/g, '')), {
        message: 'register.errors.invalid_phone',
      }),
    building: z
      .string()
      .min(1, 'register.errors.building_required')
      // Wrapped rather than passed directly: isValidBuilding is a type guard,
      // and handing it to .refine() narrows the OUTPUT type to the building
      // union while the input stays string. That input/output split is exactly
      // the zodResolver generics trap noted in the project's FE lessons, so
      // keep the predicate boolean and let the form stay string-typed.
      .refine((value): boolean => isValidBuilding(value), {
        message: 'register.errors.invalid_building',
      }),
    floor: z.string().min(1, 'register.errors.floor_required'),
    flatNumber: z
      .string()
      .min(1, 'register.errors.flat_required')
      .refine(isValidFlat, { message: 'register.errors.invalid_flat' }),
    parking: z.string().trim().max(60, 'register.errors.parking_too_long').optional(),
    jobTitle: z.string().trim().max(100, 'register.errors.job_too_long').optional(),
    maritalStatus: z.union([z.enum(maritalStatuses), z.literal('')]).optional(),
  })
  // Floor validity depends on the building's phase, so it can only be checked
  // once both are known. "G" is valid for A2 (phase 2) and invalid for A1
  // (phase 1) — and the API does NOT enforce this, so this check is the only
  // thing preventing an impossible unit from being stored.
  .superRefine((values, ctx) => {
    if (values.building && values.floor && !isValidFloorForBuilding(values.floor, values.building)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['floor'],
        message: 'register.errors.invalid_floor',
      });
    }
  });

export type RegisterUnitValues = z.infer<typeof registerUnitSchema>;
