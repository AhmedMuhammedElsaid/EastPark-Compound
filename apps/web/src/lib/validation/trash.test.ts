import { describe, expect, it } from 'vitest';

import { teamErrorKey } from '@/lib/api/super-admin';
import { translate } from '@/lib/i18n/resolve';
import ar from '@/translations/ar.json';
import en from '@/translations/en.json';

import { parsePage } from './super-admin';
import { trashIdSchema, trashItemSchema, trashQuerySchema, trashReasonKey, trashTypeSchema, TRASH_TYPES } from './trash';

describe('trashQuerySchema', () => {
  it('requires a known upper-case type', () => {
    expect(trashQuerySchema.safeParse({}).success).toBe(false);
    expect(trashQuerySchema.safeParse({ type: 'user' }).success).toBe(false);
    expect(trashQuerySchema.safeParse({ type: 'ORDER' }).success).toBe(false);
    expect(trashQuerySchema.parse({ type: 'SHOP_PHOTO', cursor: ' c1 ', limit: '10' })).toEqual({
      type: 'SHOP_PHOTO',
      cursor: 'c1',
      limit: 10,
    });
  });

  it('rejects out-of-range limits', () => {
    expect(trashQuerySchema.safeParse({ type: 'USER', limit: '0' }).success).toBe(false);
    expect(trashQuerySchema.safeParse({ type: 'USER', limit: '51' }).success).toBe(false);
  });
});

describe('path params', () => {
  it.each(TRASH_TYPES)('accepts type %s', (type) => {
    expect(trashTypeSchema.safeParse(type).success).toBe(true);
  });

  it.each(['..', 'a/b', 'a%2Fb', '', 'x'.repeat(101)])('rejects id %j', (id) => {
    expect(trashIdSchema.safeParse(id).success).toBe(false);
  });

  it('accepts uuid and cuid ids', () => {
    expect(trashIdSchema.safeParse('3f1c2b9e-7a4d-4c1e-9b2a-0d5e6f7a8b9c').success).toBe(true);
    expect(trashIdSchema.safeParse('clx1abc2300001').success).toBe(true);
  });
});

describe('trashItemSchema', () => {
  it('parses a full item and tolerates missing optional fields', () => {
    const page = parsePage(
      {
        data: {
          items: [
            {
              type: 'USER',
              id: 'u1',
              label: 'Sara (sara@x.com)',
              sublabel: 'Resident · A2-3-1',
              deletedAt: '2026-10-04T10:00:00.000Z',
              deletedBy: { id: 's1', name: 'Owner' },
              restorable: true,
              reason: null,
            },
            { type: 'REVIEW', id: 'r1', label: '5★ by Mona — Bakery', restorable: false, reason: 'trash.error.parentDeleted' },
            { type: 'ORDER', id: 'o1', label: 'not a trash type' },
          ],
          nextCursor: 'n1',
        },
      },
      trashItemSchema,
    );
    expect(page.nextCursor).toBe('n1');
    expect(page.items.map((item) => item.id)).toEqual(['u1', 'r1']);
    expect(page.items[1]).toMatchObject({ sublabel: null, deletedBy: null, deletedAt: null, restorable: false });
  });
});

describe('trashReasonKey', () => {
  it('maps the known backend keys', () => {
    expect(trashReasonKey('user.error.notRestorable')).toBe('not_restorable');
    expect(trashReasonKey('trash.error.parentDeleted')).toBe('parent_deleted');
    expect(trashReasonKey('trash.error.conflict')).toBe('conflict');
  });

  it('maps the shop owner role and second-shop reasons', () => {
    expect(trashReasonKey('trash.error.ownerNotMerchant', 'SHOP')).toBe('owner_not_merchant');
    expect(trashReasonKey('trash.error.ownerHasShop', 'SHOP')).toBe('owner_has_shop');
    expect(trashReasonKey(' trash.error.ownerHasShop ')).toBe('owner_has_shop');
  });

  it('reads parentDeleted on a shop as the owner account being deleted', () => {
    expect(trashReasonKey('trash.error.parentDeleted', 'SHOP')).toBe('owner_deleted');
    expect(trashReasonKey('trash.error.parentDeleted', 'PRODUCT')).toBe('parent_deleted');
    expect(trashReasonKey('trash.error.conflict', 'SHOP')).toBe('conflict');
  });

  it('falls back to generic for unknown keys, prose and null', () => {
    expect(trashReasonKey('trash.error.somethingNew')).toBe('generic');
    expect(trashReasonKey('The shop of this item is deleted.')).toBe('generic');
    expect(trashReasonKey(null)).toBe('generic');
  });

  it.each(['not_restorable', 'parent_deleted', 'owner_deleted', 'owner_not_merchant', 'owner_has_shop', 'conflict', 'generic'])('has ar and en copy for %s', (key) => {
    const path = `admin_trash.reasons.${key}`;
    expect(translate(en, path)).not.toBe(path);
    expect(translate(ar, path)).not.toBe(path);
  });
});

describe('teamErrorKey for delete and restore codes', () => {
  it.each(['cannot_delete_super_admin', 'delete_merchant_owns_shop', 'trash_not_found', 'restore_conflict'])(
    'keeps the explicit code %s and has ar/en copy',
    (code) => {
      expect(teamErrorKey(409, code)).toBe(code);
      const path = `admin_team.errors.${code}`;
      expect(translate(en, path)).not.toBe(path);
      expect(translate(ar, path)).not.toBe(path);
    },
  );
});
