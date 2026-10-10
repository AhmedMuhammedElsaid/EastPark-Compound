import { describe, expect, it } from 'vitest';

import { assertShopPresent, ShopGoneError } from '@/lib/api/shop-interactions';
import { translate } from '@/lib/i18n/resolve';
import ar from '@/translations/ar.json';
import en from '@/translations/en.json';

describe('deleted or unknown shop', () => {
  it('turns a 404 from the review/save routes into ShopGoneError and leaves other statuses alone', () => {
    expect(() => assertShopPresent({ status: 404 })).toThrow(ShopGoneError);
    expect(() => assertShopPresent({ status: 200 })).not.toThrow();
    expect(() => assertShopPresent({ status: 502 })).not.toThrow();
  });

  it('has its own copy in both languages', () => {
    expect(translate(en, 'directory.shop_gone')).not.toBe('directory.shop_gone');
    expect(translate(ar, 'directory.shop_gone')).not.toBe('directory.shop_gone');
  });
});
