/**
 * Client helpers for the SUPER_ADMIN-only team (users + roles) and activity-log sections. All calls
 * go through the same-origin BFF routes under `/api/admin/users` and `/api/admin/activity`; the BFF
 * returns `{ error: <code> }` with the HTTP status, and `teamErrorKey` turns that into copy keys.
 */
import type { AssignableRole, RoleName } from '@/lib/auth/roles';

import {
  activityItemSchema,
  adminUserItemSchema,
  parsePage,
  type ActivityItem,
  type AdminUserItem,
} from '@/lib/validation/super-admin';
import { trashItemSchema, type TrashItem, type TrashType } from '@/lib/validation/trash';

export type { ActivityItem, AdminUserItem, TrashItem, TrashType };

/** Error keys under `admin_team.errors.*`. */
export type TeamErrorKey =
  | 'cannot_change_super_admin'
  | 'merchant_owns_shop'
  | 'cannot_delete_super_admin'
  | 'delete_merchant_owns_shop'
  | 'trash_not_found'
  | 'restore_conflict'
  | 'super_admin_required'
  | 'admin_invite_requires_super_admin'
  | 'not_found'
  | 'validation'
  | 'rate_limited'
  | 'session'
  | 'network'
  | 'generic';

const EXPLICIT_CODES = new Set<TeamErrorKey>([
  'cannot_change_super_admin',
  'merchant_owns_shop',
  'cannot_delete_super_admin',
  'delete_merchant_owns_shop',
  'trash_not_found',
  'restore_conflict',
  'super_admin_required',
  'admin_invite_requires_super_admin',
  'not_found',
  'validation',
  'rate_limited',
]);

export class SuperAdminRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`super_admin_request_${status}`);
  }
}

/** Maps a failed request (HTTP status + BFF error code) to an `admin_team.errors.*` key. */
export function teamErrorKey(status: number, code?: string): TeamErrorKey {
  if (code && EXPLICIT_CODES.has(code as TeamErrorKey)) return code as TeamErrorKey;
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status === 401) return 'session';
  if (status === 403) return 'super_admin_required';
  if (status === 400) return 'validation';
  if (status === 0 || status === 503) return 'network';
  return 'generic';
}

async function request(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, { cache: 'no-store', ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new SuperAdminRequestError(0);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = (payload as { error?: unknown } | null)?.error;
    throw new SuperAdminRequestError(response.status, typeof code === 'string' ? code : undefined);
  }
  return payload;
}

function query(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  const text = params.toString();
  return text ? `?${text}` : '';
}

export type UserPage = { items: AdminUserItem[]; nextCursor?: string };
export type ActivityPage = { items: ActivityItem[]; nextCursor?: string };

export async function fetchUsers(options: { q?: string; role?: RoleName; cursor?: string; limit?: number }): Promise<UserPage> {
  const payload = await request(
    `/api/admin/users${query({ q: options.q?.trim(), role: options.role, cursor: options.cursor, limit: options.limit ? String(options.limit) : undefined })}`,
  );
  return parsePage(payload, adminUserItemSchema);
}

export async function changeUserRole(id: string, role: AssignableRole): Promise<AdminUserItem | null> {
  const payload = await request(
    `/api/admin/users/${encodeURIComponent(id)}/role`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) },
    30_000,
  );
  const parsed = adminUserItemSchema.safeParse((payload as { data?: unknown } | null)?.data);
  return parsed.success ? parsed.data : null;
}

/** Soft-deletes an account (signed out + hidden; restorable from the recycle bin). No request body. */
export async function deleteUser(id: string): Promise<void> {
  await request(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }, 30_000);
}

export type TrashPage = { items: TrashItem[]; nextCursor?: string };

export async function fetchTrash(options: { type: TrashType; cursor?: string }): Promise<TrashPage> {
  const payload = await request(`/api/admin/trash${query({ type: options.type, cursor: options.cursor })}`);
  return parsePage(payload, trashItemSchema);
}

/** Restores a soft-deleted item. Returns the restored item when the backend sends one. No request body. */
export async function restoreTrashItem(type: TrashType, id: string): Promise<TrashItem | null> {
  const payload = await request(
    `/api/admin/trash/${type}/${encodeURIComponent(id)}/restore`,
    { method: 'POST' },
    30_000,
  );
  const parsed = trashItemSchema.safeParse((payload as { data?: unknown } | null)?.data);
  return parsed.success ? parsed.data : null;
}

export async function fetchActivity(options: { actorId?: string; cursor?: string }): Promise<ActivityPage> {
  const payload = await request(`/api/admin/activity${query({ actorId: options.actorId, cursor: options.cursor })}`);
  return parsePage(payload, activityItemSchema);
}

/** Admin-like accounts for the activity filter (both roles, up to 50 each). Failures yield `[]`. */
export async function fetchAdminActors(): Promise<AdminUserItem[]> {
  const pages = await Promise.allSettled([
    fetchUsers({ role: 'SUPER_ADMIN', limit: 50 }),
    fetchUsers({ role: 'ADMIN', limit: 50 }),
  ]);
  const seen = new Set<string>();
  const actors: AdminUserItem[] = [];
  for (const page of pages) {
    if (page.status !== 'fulfilled') continue;
    for (const user of page.value.items) {
      if (seen.has(user.id)) continue;
      seen.add(user.id);
      actors.push(user);
    }
  }
  return actors;
}
