import { describe, expect, it } from 'vitest';

import { parseNotificationPage, parseNotificationPreferences } from '@/lib/api/notifications';

function item(id: string, type: string) {
  return {
    id,
    type,
    title: 't',
    titleAr: 't',
    body: 'b',
    bodyAr: 'b',
    data: null,
    isRead: false,
    createdAt: '2026-11-02T10:00:00.000Z',
  };
}

describe('notification parsing', () => {
  it('parses LISTING_UPDATE feed items and preferences', () => {
    const page = parseNotificationPage({
      data: { items: [item('1', 'LISTING_UPDATE')], unreadCount: 1 },
    });
    expect(page.items.map((n) => n.type)).toEqual(['LISTING_UPDATE']);
    expect(
      parseNotificationPreferences({ data: [{ type: 'LISTING_UPDATE', enabled: true }] }),
    ).toEqual([{ type: 'LISTING_UPDATE', enabled: true }]);
  });

  it('ignores unknown types instead of throwing', () => {
    const page = parseNotificationPage({
      data: { items: [item('1', 'FUTURE_TYPE'), item('2', 'POLL')], nextCursor: 'c', unreadCount: 2 },
    });
    expect(page.items.map((n) => n.id)).toEqual(['2']);
    expect(page.nextCursor).toBe('c');
    expect(page.unreadCount).toBe(2);
    expect(
      parseNotificationPreferences({
        data: [
          { type: 'FUTURE_TYPE', enabled: true },
          { type: 'POLL', enabled: false },
        ],
      }),
    ).toEqual([{ type: 'POLL', enabled: false }]);
  });

  it('still rejects a malformed envelope', () => {
    expect(() => parseNotificationPage({ data: { unreadCount: 0 } })).toThrow();
    expect(() => parseNotificationPreferences({})).toThrow();
  });
});
