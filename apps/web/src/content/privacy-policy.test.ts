import { describe, expect, it } from 'vitest';

import { NextRequest } from 'next/server';

import { proxy } from '@/proxy';

import sitemap from '@/app/sitemap';

import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_POLICY,
} from './privacy-policy';

describe('privacy policy content', () => {
  const { ar, en } = PRIVACY_POLICY;

  it('has the same sections, in the same order, in both languages', () => {
    expect(ar.sections.map((s) => s.id)).toEqual(en.sections.map((s) => s.id));
  });

  it('keeps list and paragraph counts in sync between languages', () => {
    ar.sections.forEach((section, index) => {
      const other = en.sections[index]!;
      expect(section.items?.length ?? 0, section.id).toBe(other.items?.length ?? 0);
      expect(section.paragraphs?.length ?? 0, section.id).toBe(other.paragraphs?.length ?? 0);
    });
    expect(ar.intro.length).toBe(en.intro.length);
  });

  it('has no empty text', () => {
    for (const doc of [ar, en]) {
      for (const section of doc.sections) {
        expect(section.heading.trim()).not.toBe('');
        for (const text of [...(section.paragraphs ?? []), ...(section.items ?? [])]) {
          expect(text.trim()).not.toBe('');
        }
      }
    }
  });

  it('names the contact address and the effective date in both languages', () => {
    expect(PRIVACY_EFFECTIVE_DATE).toBe('2026-10-12');
    for (const doc of [ar, en]) {
      const all = JSON.stringify(doc);
      expect(all).toContain(PRIVACY_CONTACT_EMAIL);
    }
  });
});

describe('privacy route reachability', () => {
  it('is in the sitemap', () => {
    expect(sitemap().some((entry) => entry.url.endsWith('/privacy'))).toBe(true);
  });

  it('is not gated by the resident lockdown proxy', () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'HS256' })}.${encode({ role: 'RESIDENT' })}.sig`;
    const response = proxy(
      new NextRequest('https://web.test/privacy', { headers: { cookie: `eastpark_access=${token}` } }),
    );
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});
