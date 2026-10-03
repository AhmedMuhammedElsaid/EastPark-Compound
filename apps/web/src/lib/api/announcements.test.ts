import { describe, expect, it } from 'vitest';

import { parseAnnouncementDetail } from './announcements';
import { parseReviewPage } from './shop-interactions';

const ANNOUNCEMENT = {
  id: 'a1',
  title: 'Water maintenance',
  titleAr: 'صيانة المياه',
  body: 'Body',
  bodyAr: 'نص',
  category: 'MAINTENANCE',
  pdfUrl: null,
  publishedAt: '2026-10-01T00:00:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
};

describe('announcement comment contract', () => {
  it('accepts the guest/non-owner shape without userId or user.id', () => {
    const detail = parseAnnouncementDetail({
      data: {
        ...ANNOUNCEMENT,
        comments: [{ id: 'c1', body: 'Thanks', createdAt: '2026-10-02T00:00:00.000Z', user: { name: 'Ahmed' } }],
      },
    });
    expect(detail.comments[0]).toMatchObject({ id: 'c1', user: { name: 'Ahmed' } });
    expect(detail.comments[0]!.userId).toBeUndefined();
  });

  it('still accepts the owner/admin shape with ids', () => {
    const detail = parseAnnouncementDetail({
      data: {
        ...ANNOUNCEMENT,
        comments: [
          { id: 'c1', body: 'Mine', userId: 'u1', createdAt: '2026-10-02T00:00:00.000Z', user: { id: 'u1', name: 'Ahmed Elsaid' } },
        ],
      },
    });
    expect(detail.comments[0]).toMatchObject({ userId: 'u1', user: { id: 'u1' } });
  });
});

describe('review contract', () => {
  it('accepts reviews whose author id is hidden', () => {
    const page = parseReviewPage({
      data: { items: [{ id: 'r1', rating: 5, comment: null, user: { name: 'Mona' }, createdAt: '2026-10-02T00:00:00.000Z' }] },
    });
    expect(page.items[0]!.user.name).toBe('Mona');
  });
});
