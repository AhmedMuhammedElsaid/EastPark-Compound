import { z } from 'zod';

import type { AuthResponse, AuthTokens, AuthUser, ResidentUnit } from '@/lib/api/contracts';

import { ROLES } from '@/lib/auth/roles';

const nullableString = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

export const residentUnitSchema: z.ZodType<ResidentUnit> = z.object({
  id: z.string().min(1),
  building: z.string(),
  floor: z.string(),
  flatNumber: z.string(),
  label: z.string().min(1),
  createdAt: z.string(),
});

/**
 * `units` is only on `GET /user/profile`; every other user payload (and an older backend) parses to
 * `[]`. A malformed list degrades to `[]` instead of failing the whole session.
 */
export const residentUnitsSchema = z.array(residentUnitSchema).optional().default([]).catch([]);

export const authUserSchema: z.ZodType<AuthUser, unknown> = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.email(),
  phone: nullableString,
  unitNumber: nullableString,
  units: residentUnitsSchema,
  avatarUrl: nullableString,
  role: z.enum(ROLES),
  isVerified: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const authTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

export const authUserEnvelopeSchema: z.ZodType<{ data: AuthUser }, unknown> = z.object({ data: authUserSchema });
export const authTokensEnvelopeSchema: z.ZodType<{ data: AuthTokens }> = z.object({ data: authTokensSchema });
export const authResponseEnvelopeSchema: z.ZodType<{ data: AuthResponse }, unknown> = z.object({
  data: authTokensSchema.extend({ user: authUserSchema }),
});

/** Parses a backend auth envelope; `null` signals contract drift (never a transport failure). */
export async function readAuthResponse(response: Response): Promise<AuthResponse | null> {
  const parsed = authResponseEnvelopeSchema.safeParse(await response.json().catch(() => null));
  return parsed.success ? parsed.data.data : null;
}
