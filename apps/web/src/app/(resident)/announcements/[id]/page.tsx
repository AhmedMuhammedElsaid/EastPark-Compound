import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AnnouncementDetailView } from '@/components/app/AnnouncementDetailView';
import {
  AnnouncementRequestError,
  getAnnouncementDetail,
} from '@/lib/api/announcements.server';
import { requestClientIp } from '@/lib/auth/server';

export const metadata: Metadata = { title: 'إعلان' };

type AnnouncementDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AnnouncementDetailPage({ params }: AnnouncementDetailPageProps) {
  const { id } = await params;
  const announcement = await getAnnouncementDetail(id, { clientIp: await requestClientIp() }).catch((error) => {
    if (error instanceof AnnouncementRequestError && error.status === 404) notFound();
    console.error('Announcement detail page failed', error);
    return null;
  });

  return <AnnouncementDetailView announcement={announcement} />;
}