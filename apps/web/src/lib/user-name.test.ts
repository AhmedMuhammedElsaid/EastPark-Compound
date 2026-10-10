import { describe, expect, it } from 'vitest';

import { displayUserName, isDeletedUserName } from '@/lib/user-name';
import ar from '@/translations/ar.json';
import en from '@/translations/en.json';

describe('displayUserName', () => {
  it('swaps the English tombstone name for the localized label', () => {
    expect(displayUserName('Deleted user', 'مستخدم محذوف')).toBe('مستخدم محذوف');
    expect(displayUserName(' Deleted user ', 'x')).toBe('x');
  });
  it('keeps real names', () => {
    expect(displayUserName('Mona', 'x')).toBe('Mona');
    expect(isDeletedUserName(undefined)).toBe(false);
  });
  it('has the label in both languages', () => {
    expect(en.common.deleted_user).toBe('Deleted user');
    expect(ar.common.deleted_user).not.toBe(en.common.deleted_user);
  });
});
