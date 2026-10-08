import { describe, expect, it } from 'vitest';

import {
  adminMerchantItemSchema,
  emptyShopForm,
  merchantsQuerySchema,
  normalizePhone,
  shopCreateSchema,
  shopFormSchema,
  toShopCreatePayload,
  weekDays,
  type ShopFormValues,
} from './admin-shops';

function form(overrides: Partial<ShopFormValues> = {}): ShopFormValues {
  return { ...emptyShopForm('m1'), name: 'Corner Cafe', nameAr: 'كافيه الزاوية', ...overrides };
}

describe('normalizePhone', () => {
  it('turns local Egyptian mobiles and 00-prefixes into + format', () => {
    expect(normalizePhone('010 1234 5678')).toBe('+201012345678');
    expect(normalizePhone('00201012345678')).toBe('+201012345678');
    expect(normalizePhone('+20-101-234-5678')).toBe('+201012345678');
  });
});

describe('shopFormSchema', () => {
  it('accepts the minimal form (names, category, merchant)', () => {
    expect(shopFormSchema.safeParse(form()).success).toBe(true);
  });

  it.each([
    ['no merchant', { merchantId: '' }],
    ['no Arabic name', { nameAr: '   ' }],
    ['a short phone', { phone: '12345' }],
    ['a whatsapp without country code', { whatsapp: '1012345678' }],
    ['a zero delivery time', { deliveryTime: '0' }],
    ['a fractional delivery time', { deliveryTime: '2.5' }],
  ])('rejects %s', (_, overrides) => {
    expect(shopFormSchema.safeParse(form(overrides)).success).toBe(false);
  });

  it('only checks the times of an open day', () => {
    const hours = { ...form().hours, mon: { open: '', close: '', closed: true } };
    expect(shopFormSchema.safeParse(form({ hoursEnabled: true, hours })).success).toBe(true);
    const bad = { ...form().hours, mon: { open: '25:00', close: '22:00', closed: false } };
    expect(shopFormSchema.safeParse(form({ hoursEnabled: true, hours: bad })).success).toBe(false);
  });
});

describe('toShopCreatePayload', () => {
  it('drops empty optional fields and never sends isOpen', () => {
    const payload = toShopCreatePayload(form({ description: '  ', phone: '' }));
    expect(payload).toEqual({
      merchantId: 'm1', name: 'Corner Cafe', nameAr: 'كافيه الزاوية', category: 'CAFE_AND_FOOD',
      description: undefined, descriptionAr: undefined, phone: undefined, whatsapp: undefined,
      deliveryTime: undefined, workingHours: undefined,
    });
    expect(JSON.parse(JSON.stringify(payload))).not.toHaveProperty('isOpen');
    expect(shopCreateSchema.safeParse(payload).success).toBe(true);
  });

  it('normalises phones, converts delivery time and sends all seven days when hours are on', () => {
    const hours = { ...form().hours, fri: { open: '', close: '', closed: true } };
    const payload = toShopCreatePayload(form({ phone: '01012345678', whatsapp: '+201112345678', deliveryTime: ' 30 ', hoursEnabled: true, hours }));
    expect(payload.phone).toBe('+201012345678');
    expect(payload.whatsapp).toBe('+201112345678');
    expect(payload.deliveryTime).toBe(30);
    expect(Object.keys(payload.workingHours ?? {}).sort()).toEqual([...weekDays].sort());
    // A closed day keeps valid placeholder times: the backend validates them even when closed.
    expect(payload.workingHours?.fri).toEqual({ open: '09:00', close: '22:00', closed: true });
    expect(shopCreateSchema.safeParse(payload).success).toBe(true);
  });
});

describe('shopCreateSchema (BFF)', () => {
  it('strips unknown keys such as isOpen', () => {
    const parsed = shopCreateSchema.parse({ merchantId: 'm1', name: 'A', nameAr: 'ب', category: 'OTHER', isOpen: false, extra: 1 });
    expect(parsed).not.toHaveProperty('isOpen');
    expect(parsed).not.toHaveProperty('extra');
  });

  it('rejects a working-hours day without times', () => {
    expect(
      shopCreateSchema.safeParse({ merchantId: 'm1', name: 'A', nameAr: 'ب', category: 'OTHER', workingHours: { mon: { closed: true } } }).success,
    ).toBe(false);
  });
});

describe('merchant picker schemas', () => {
  it('trims q and coerces limit', () => {
    expect(merchantsQuerySchema.parse({ q: ' mona ', limit: '10', cursor: '' })).toEqual({ q: 'mona', limit: 10 });
    expect(merchantsQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
  });

  it('parses a merchant with or without a shop', () => {
    expect(adminMerchantItemSchema.parse({ id: 'm1', name: 'Mona', email: 'm@x.test', shop: null }).shop).toBeNull();
    expect(adminMerchantItemSchema.parse({ id: 'm1', name: 'Mona', email: 'm@x.test' }).shop).toBeNull();
    expect(adminMerchantItemSchema.parse({ id: 'm1', name: 'Mona', email: 'm@x.test', shop: { id: 's1', name: 'Cafe', nameAr: 'كافيه' } }).shop).toEqual({
      id: 's1', name: 'Cafe', nameAr: 'كافيه',
    });
  });
});
