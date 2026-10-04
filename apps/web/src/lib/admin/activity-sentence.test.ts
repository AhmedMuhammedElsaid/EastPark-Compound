import { describe, expect, it } from 'vitest';

import { translate } from '@/lib/i18n/resolve';
import { teamErrorKey } from '@/lib/api/super-admin';
import ar from '@/translations/ar.json';
import en from '@/translations/en.json';

import { activityParts, activitySentence, humaniseCode, KNOWN_ACTIONS } from './activity-sentence';

const tEn = (key: string, vars?: Record<string, string | number>) => translate(en, key, vars);
const tAr = (key: string, vars?: Record<string, string | number>) => translate(ar, key, vars);

const actor = { id: 'a1', name: 'Sameh', email: 'sameh@example.com', role: 'ADMIN' };

describe('activity sentences', () => {
  it('reads "<actor> <verb>: <label>" in English and Arabic', () => {
    const item = { action: 'LEAD_APPROVED', meta: { label: 'Mona — A2/3/1' }, actor };
    expect(activitySentence(activityParts(item, tEn))).toBe('Sameh approved unit registration: Mona — A2/3/1');
    expect(activitySentence(activityParts({ ...item, actor: { ...actor, name: 'سامح' } }, tAr))).toBe(
      'سامح قبل تسجيل وحدة: Mona — A2/3/1',
    );
  });

  it.each(KNOWN_ACTIONS)('has ar and en copy for %s', (action) => {
    const key = `admin_activity.actions.${action}`;
    expect(tEn(key)).not.toBe(key);
    expect(tAr(key)).not.toBe(key);
  });

  it('renders unknown actions generically with the humanised code', () => {
    const parts = activityParts({ action: 'SHOP_ARCHIVED', meta: { label: 'Bakery' }, actor }, tEn);
    expect(activitySentence(parts)).toBe('Sameh performed "shop archived": Bakery');
  });

  it('omits the colon when there is no label and never leaves placeholders', () => {
    const sentence = activitySentence(activityParts({ action: 'POLL_DELETED', meta: null, actor }, tEn));
    expect(sentence).toBe('Sameh deleted the poll');
    expect(sentence).not.toContain('{{');
  });

  it('falls back to the email, then a generic actor', () => {
    expect(activityParts({ action: 'POLL_CREATED', meta: null, actor: { ...actor, name: ' ' } }, tEn).actor).toBe(
      'sameh@example.com',
    );
    expect(activityParts({ action: 'POLL_CREATED', meta: null, actor: { ...actor, name: '', email: '' } }, tEn).actor).toBe(
      'An admin',
    );
  });

  it('adds role and status details', () => {
    expect(
      activityParts({ action: 'USER_ROLE_CHANGED', meta: { label: 'M (m@x.com)', fromRole: 'RESIDENT', toRole: 'ADMIN' }, actor }, tEn)
        .detail,
    ).toBe('Resident → Compound admin');
    expect(activityParts({ action: 'INVITATION_SENT', meta: { label: 'x@y.com', role: 'MERCHANT' }, actor }, tEn).detail).toBe(
      'Role: Merchant',
    );
    expect(
      activityParts({ action: 'FEEDBACK_STATUS_CHANGED', meta: { label: 'Noise', status: 'IN_PROGRESS' }, actor }, tEn).detail,
    ).toBe('Status: In progress');
    expect(activityParts({ action: 'ORDER_STATUS_CHANGED', meta: { label: '#12', status: 'OUT_FOR_DELIVERY' }, actor }, tEn).detail).toBe(
      'Status: out for delivery',
    );
  });

  it('humanises codes', () => {
    expect(humaniseCode('ELECTION_RESULTS_OPENED')).toBe('election results opened');
  });
});

describe('teamErrorKey', () => {
  it('prefers the explicit BFF code', () => {
    expect(teamErrorKey(409, 'merchant_owns_shop')).toBe('merchant_owns_shop');
    expect(teamErrorKey(403, 'cannot_change_super_admin')).toBe('cannot_change_super_admin');
    expect(teamErrorKey(403, 'super_admin_required')).toBe('super_admin_required');
  });

  it('falls back to the status', () => {
    expect(teamErrorKey(404)).toBe('not_found');
    expect(teamErrorKey(429, 'rate_limited')).toBe('rate_limited');
    expect(teamErrorKey(401, 'unauthorized')).toBe('session');
    expect(teamErrorKey(0)).toBe('network');
    expect(teamErrorKey(503, 'network')).toBe('network');
    expect(teamErrorKey(502, 'upstream')).toBe('generic');
  });

  it('has copy for every key in both languages', () => {
    for (const key of ['cannot_change_super_admin', 'merchant_owns_shop', 'super_admin_required', 'admin_invite_requires_super_admin', 'not_found', 'validation', 'rate_limited', 'session', 'network', 'generic']) {
      expect(tEn(`admin_team.errors.${key}`)).not.toBe(`admin_team.errors.${key}`);
      expect(tAr(`admin_team.errors.${key}`)).not.toBe(`admin_team.errors.${key}`);
    }
  });
});
