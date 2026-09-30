import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateCartTotal,
  canResidentCancelOrder,
  hasCartShopConflict,
  selectLocalizedValue,
} from './index.ts';

test('selectLocalizedValue prefers the requested language and falls back', () => {
  assert.equal(selectLocalizedValue('ar', 'Coffee', 'قهوة'), 'قهوة');
  assert.equal(selectLocalizedValue('en', 'Coffee', 'قهوة'), 'Coffee');
  assert.equal(selectLocalizedValue('ar', 'Coffee', '  '), 'Coffee');
});

test('hasCartShopConflict rejects adding products from another shop', () => {
  assert.equal(hasCartShopConflict(null, 'shop-1'), false);
  assert.equal(hasCartShopConflict('shop-1', 'shop-1'), false);
  assert.equal(hasCartShopConflict('shop-1', 'shop-2'), true);
});

test('calculateCartTotal accounts for quantity without rounding money', () => {
  const total = calculateCartTotal([
    { id: '1', name: 'One', nameAr: 'واحد', price: 10, imageUrl: null, quantity: 2 },
    { id: '2', name: 'Two', nameAr: 'اثنان', price: 7.5, imageUrl: null, quantity: 3 },
  ]);

  assert.equal(total, 42.5);
});

test('canResidentCancelOrder only allows newly placed orders', () => {
  assert.equal(canResidentCancelOrder('PLACED'), true);
  assert.equal(canResidentCancelOrder('CONFIRMED'), false);
  assert.equal(canResidentCancelOrder('CANCELLED'), false);
});