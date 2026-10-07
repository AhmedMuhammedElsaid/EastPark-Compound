/**
 * Schemas for the SUPER_ADMIN-only team (users + roles) and activity-log features. Shared by the
 * BFF routes (input validation) and the client (lenient response parsing). Dependency-free besides zod.
 */
import { z } from 'zod';

import { residentUnitSchema, residentUnitsSchema } from '@/lib/api/auth-schemas';
import { ASSIGNABLE_ROLES, ROLES } from '@/lib/auth/roles';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const limit = z.coerce.number().int().min(1).max(50).optional();

/** `GET /api/admin/users` query → backend `GET /v1/admin/user`. */
export const usersQuerySchema = z.object({
  cursor: optionalText(200),
  limit,
  q: optionalText(100),
  role: z.enum(ROLES).optional(),
});

/** `GET /api/admin/activity` query → backend `GET /v1/admin/activity`. */
export const activityQuerySchema = z.object({
  cursor: optionalText(200),
  limit,
  actorId: optionalText(100),
});

/** `PATCH /api/admin/users/:id/role` body. SUPER_ADMIN and GUEST are never assignable. */
export const roleChangeSchema = z.object({ role: z.enum(ASSIGNABLE_ROLES) });

export const userIdSchema = z.string().trim().min(1).max(100);

/** `:unitId` of `DELETE /api/admin/users/:id/units/:unitId`. */
export const unitIdSchema = z.string().trim().min(1).max(100);

/** The `POST /api/admin/users/:id/units` response (`201` with the new flat). */
export const addedUnitEnvelopeSchema = z.object({ data: residentUnitSchema });

/** Reads URL search params into a plain object, treating empty values as absent. */
export function searchParamsObject(params: URLSearchParams, keys: readonly string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null && value.trim() !== '') result[key] = value;
  }
  return result;
}

/** Rebuilds a backend query string from validated values only. */
export function toQueryString(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

const nullableString = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

export const adminUserItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().catch(''),
  email: z.string().catch(''),
  role: z.enum(ROLES),
  unitNumber: nullableString.catch(null),
  // Malformed flats never hide the person's row; an older backend sends none.
  units: residentUnitsSchema,
  createdAt: z.string().catch(''),
});
export type AdminUserItem = z.infer<typeof adminUserItemSchema>;

export const activityItemSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  entity: z.string().catch(''),
  entityId: nullableString.catch(null),
  meta: z.record(z.string(), z.unknown()).nullish().transform((value) => value ?? null).catch(null),
  createdAt: z.string().catch(''),
  // Always present today (audit rows require a user); tolerated as null so an entry never vanishes.
  actor: z
    .object({
      id: z.string().catch(''),
      name: z.string().catch(''),
      email: z.string().catch(''),
      role: z.string().catch(''),
    })
    .nullish()
    .transform((value) => value ?? null)
    .catch(null),
});
export type ActivityItem = z.infer<typeof activityItemSchema>;

/**
 * Parses a backend page envelope leniently: items that fail validation are dropped (and the rest
 * still render) instead of failing the whole page.
 */
export function parsePage<T>(payload: unknown, item: z.ZodType<T>): { items: T[]; nextCursor?: string } {
  const data = (payload as { data?: { items?: unknown; nextCursor?: unknown } } | null)?.data;
  const rawItems = Array.isArray(data?.items) ? data.items : [];
  const items: T[] = [];
  for (const raw of rawItems) {
    const parsed = item.safeParse(raw);
    if (parsed.success) items.push(parsed.data);
  }
  const nextCursor = typeof data?.nextCursor === 'string' && data.nextCursor ? data.nextCursor : undefined;
  return { items, nextCursor };
}
