import { describe, expect, it } from 'vitest';

import ar from '@/translations/ar.json';
import en from '@/translations/en.json';

function keyPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('translations', () => {
  it('ar.json and en.json define the same keys', () => {
    const arKeys = new Set(keyPaths(ar));
    const enKeys = new Set(keyPaths(en));
    expect([...enKeys].filter((key) => !arKeys.has(key)), 'missing in ar.json').toEqual([]);
    expect([...arKeys].filter((key) => !enKeys.has(key)), 'missing in en.json').toEqual([]);
  });
});
