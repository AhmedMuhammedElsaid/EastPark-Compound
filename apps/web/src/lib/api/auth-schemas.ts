import { z } from 'zod';

import type { AuthResponse, AuthTokens, AuthUser } from '@/lib/api/contracts';

import { ROLES } from '@/lib/auth/roles';

const nullableString = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

export const authUserSchema: z.ZodType<AuthUser> = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.email(),
  phone: nullableString,
  unitNumber: nullableString,
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

export const authUserEnvelopeSchema: z.ZodType<{ data: AuthUser }> = z.object({ data: authUserSchema });
export const authTokensEnvelopeSchema: z.ZodType<{ data: AuthTokens }> = z.object({ data: authTokensSchema });
export const authResponseEnvelopeSchema: z.ZodType<{ data: AuthResponse }> = z.object({
  data: authTokensSchema.extend({ user: authUserSchema }),
});

/** Parses a backend auth envelope; `null` signals contract drift (never a transport failure). */
export async function readAuthResponse(response: Response): Promise<AuthResponse | null> {
  const parsed = authResponseEnvelopeSchema.safeParse(await response.json().catch(() => null));
  return parsed.success ? parsed.data.data : null;
}
