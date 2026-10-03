import type { Metadata } from 'next';

import { AnnouncementFeed } from '@/components/app/AnnouncementFeed';
import { isAnnouncementCategory } from '@/lib/api/announcements';
import { getAnnouncements } from '@/lib/api/announcements.server';
import { requestClientIp } from '@/lib/auth/server';

export const metadata: Metadata = { title: 'الإعلانات' };

type AnnouncementsPageProps = {
  searchParams: Promise<{ category?: string }>;
};

export default async function AnnouncementsPage({ searchParams }: AnnouncementsPageProps) {
  const { category: categoryValue } = await searchParams;
  const category = categoryValue && isAnnouncementCategory(categoryValue) ? categoryValue : undefined;
  const initialPage = await getAnnouncements({ category }, { clientIp: await requestClientIp() }).catch((error) => {
    console.error('Announcements page failed', error);
    return null;
  });

  // Keyed by category: the feed copies `initialPage` into state, so a client-side filter change must
  // remount it or the old category's items and cursor would stay on screen.
  return <AnnouncementFeed key={category ?? 'ALL'} category={category} initialPage={initialPage} />;
}