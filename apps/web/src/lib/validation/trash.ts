/**
 * Schemas for the SUPER_ADMIN-only recycle bin (soft-deleted users, shops, shop photos, products and
 * reviews). Shared by the BFF routes (input validation) and the client (lenient response parsing).
 */
import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const TRASH_TYPES = ['USER', 'SHOP', 'SHOP_PHOTO', 'PRODUCT', 'REVIEW'] as const;
export type TrashType = (typeof TRASH_TYPES)[number];

export const trashTypeSchema = z.enum(TRASH_TYPES);

/** `GET /api/admin/trash` query → backend `GET /v1/admin/trash`. `type` is required. */
export const trashQuerySchema = z.object({
  type: trashTypeSchema,
  cursor: optionalText(200),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/** Path segment ids (no slashes, no dot segments). */
export const trashIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);

const nullableString = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

export const trashItemSchema = z.object({
  type: trashTypeSchema,
  id: z.string().min(1),
  label: z.string().catch(''),
  sublabel: nullableString.catch(null),
  deletedAt: nullableString.catch(null),
  deletedBy: z
    .object({ id: z.string().catch(''), name: z.string().catch('') })
    .nullish()
    .transform((value) => value ?? null)
    .catch(null),
  restorable: z.boolean().catch(false),
  reason: nullableString.catch(null),
});
export type TrashItem = z.infer<typeof trashItemSchema>;

/** Known backend reason keys → `admin_trash.reasons.*` copy keys. */
const REASON_KEYS: Record<string, string> = {
  'user.error.notRestorable': 'not_restorable',
  'trash.error.parentDeleted': 'parent_deleted',
  'trash.error.conflict': 'conflict',
};

type TrashReasonKey = 'not_restorable' | 'parent_deleted' | 'owner_deleted' | 'conflict' | 'generic';

/**
 * Copy key under `admin_trash.reasons.*` for an item that can't be restored. Unknown keys and
 * backend prose (never rendered raw) fall back to the generic reason. A SHOP's parent is its
 * merchant account, so `parentDeleted` on a shop reads as "the owner's account is deleted".
 */
export function trashReasonKey(reason: string | null, type?: TrashType): TrashReasonKey {
  const key = (reason && (REASON_KEYS[reason.trim()] as TrashReasonKey | undefined)) || 'generic';
  return key === 'parent_deleted' && type === 'SHOP' ? 'owner_deleted' : key;
}
