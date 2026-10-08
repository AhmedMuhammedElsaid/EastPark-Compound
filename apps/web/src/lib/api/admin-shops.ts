/**
 * Client helpers for the admin "Shops" section. Every call goes through the same-origin BFF
 * (`/api/admin/merchants`, `/api/admin/shops`, `/api/uploads/image?purpose=shop`); the BFF answers
 * `{ error: <code> }` with the HTTP status and `shopErrorKey` turns that into `admin_shops.errors.*`.
 */
import { parseUploadResult } from '@/lib/api/feedback';
import { adminMerchantItemSchema, type AdminMerchantItem, type ShopCreatePayload } from '@/lib/validation/admin-shops';
import { parsePage } from '@/lib/validation/super-admin';

export type { AdminMerchantItem };
export type MerchantPage = { items: AdminMerchantItem[]; nextCursor?: string };

export type ShopErrorKey =
  | 'merchant_invalid'
  | 'merchant_has_shop'
  | 'validation'
  | 'forbidden'
  | 'photo_upload'
  | 'rate_limited'
  | 'session'
  | 'network'
  | 'generic';

export class AdminShopsRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`admin_shops_request_${status}`);
  }
}

/** Maps a failed request (HTTP status + BFF error code) to an `admin_shops.errors.*` key. */
export function shopErrorKey(status: number, code?: string): ShopErrorKey {
  if (code === 'merchant_invalid' || code === 'merchant_has_shop' || code === 'photo_upload') return code;
  if (status === 409) return 'merchant_has_shop';
  if (status === 400) return 'validation';
  if (status === 401) return 'session';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rate_limited';
  if (status === 0 || status === 503) return 'network';
  return 'generic';
}

export function errorKeyOf(error: unknown): ShopErrorKey {
  return error instanceof AdminShopsRequestError ? shopErrorKey(error.status, error.code) : 'generic';
}

async function request(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, { cache: 'no-store', ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new AdminShopsRequestError(0);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = (payload as { error?: unknown } | null)?.error;
    throw new AdminShopsRequestError(response.status, typeof code === 'string' ? code : undefined);
  }
  return payload;
}

export async function fetchMerchants(options: { q?: string; cursor?: string; limit?: number } = {}): Promise<MerchantPage> {
  const params = new URLSearchParams();
  if (options.q?.trim()) params.set('q', options.q.trim());
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  return parsePage(await request(`/api/admin/merchants${query ? `?${query}` : ''}`), adminMerchantItemSchema);
}

/** Uploads the cover photo; any failure is `photo_upload` (the shop is not created yet). */
export async function uploadShopPhoto(file: File): Promise<string> {
  const formData = new FormData();
  formData.set('file', file, file.name);
  try {
    const payload = await request('/api/uploads/image?purpose=shop', { method: 'POST', body: formData }, 30_000);
    return parseUploadResult(payload).url;
  } catch (error) {
    // Session/throttle answers keep their own copy; everything else is a photo problem.
    if (error instanceof AdminShopsRequestError && [401, 429].includes(error.status)) throw error;
    throw new AdminShopsRequestError(422, 'photo_upload');
  }
}

/** Creates the shop and returns its id (backend `201 { data: ShopResponseDto }`). */
export async function createShop(payload: ShopCreatePayload): Promise<{ id: string }> {
  const result = await request(
    '/api/admin/shops',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    30_000,
  );
  const id = (result as { data?: { id?: unknown } } | null)?.data?.id;
  if (typeof id !== 'string' || !id) throw new AdminShopsRequestError(502);
  return { id };
}

export async function addShopPhoto(shopId: string, url: string): Promise<void> {
  await request(
    `/api/admin/shops/${encodeURIComponent(shopId)}/photos`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) },
    30_000,
  );
}
