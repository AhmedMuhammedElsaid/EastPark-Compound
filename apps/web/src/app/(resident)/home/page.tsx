import type { Metadata } from 'next';

import { headers } from 'next/headers';
import { Suspense } from 'react';

import { ResidentHome } from '@/components/app/ResidentHome';
import { LatestAnnouncement, LatestAnnouncementSkeleton } from '@/components/app/home/LatestAnnouncement';
import type { Announcement } from '@/lib/api/announcements';
import { getAnnouncements } from '@/lib/api/announcements.server';
import { clientIpFrom } from '@/lib/auth/server';

export const metadata: Metadata = { title: 'الرئيسية' };

async function loadLatestAnnouncement(): Promise<Announcement | null> {
  // Reading the request headers OUTSIDE the try/catch makes this loader request-time. Previously the
  // route was prerendered at build, freezing whatever the build saw (usually the empty state). It
  // also forwards the visitor's IP so backend rate limiting is per visitor, not per Vercel egress IP.
  const clientIp = clientIpFrom(await headers());
  try {
    const page = await getAnnouncements({}, { clientIp });
    return page.items[0] ?? null;
  } catch {
    // Backend may be cold-starting; the home page must still render.
    return null;
  }
}

async function LatestAnnouncementLoader() {
  return <LatestAnnouncement announcement={await loadLatestAnnouncement()} />;
}

export default function ResidentHomePage() {
  // The page shell renders immediately; the announcement streams in behind a skeleton so a
  // backend cold start cannot block /home.
  return (
    <ResidentHome
      latestSlot={
        <Suspense fallback={<LatestAnnouncementSkeleton />}>
          <LatestAnnouncementLoader />
        </Suspense>
      }
    />
  );
}
