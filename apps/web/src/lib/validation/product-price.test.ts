import { describe, expect, it } from 'vitest';

import { productPriceProblem } from './product-price';

describe('productPriceProblem', () => {
  it.each([['35'], ['0.01'], ['35.50'], ['35.5'], ['100000'], ['100000.00'], ['12.30']])('accepts %s', (value) => {
    expect(productPriceProblem(value)).toBeNull();
  });

  it.each([
    ['', 'required'],
    ['  ', 'required'],
    ['abc', 'required'],
    ['0', 'min'],
    ['0.001', 'min'],
    ['-5', 'min'],
    ['100000.01', 'max'],
    ['1e9', 'max'],
    ['10.123', 'decimals'],
    ['0.015', 'decimals'],
  ])('rejects %s as %s', (value, problem) => {
    expect(productPriceProblem(value)).toBe(problem);
  });
});

describe('productInputSchema price', () => {
  const base = { name: 'a', nameAr: 'ا' };
  it('matches the backend bounds', async () => {
    const { productInputSchema } = await import('@/lib/schemas/merchant');
    expect(productInputSchema.safeParse({ ...base, price: 0.01 }).success).toBe(true);
    expect(productInputSchema.safeParse({ ...base, price: 100000 }).success).toBe(true);
    expect(productInputSchema.safeParse({ ...base, price: 0 }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, price: 100000.01 }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, price: 1.005 }).success).toBe(false);
  });
});
