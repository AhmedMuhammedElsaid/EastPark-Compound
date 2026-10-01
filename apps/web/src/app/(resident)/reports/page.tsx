import type { Metadata } from 'next';

import { ReportFeed } from '@/components/app/ReportFeed';
import { getReports } from '@/lib/api/reports.server';

export const metadata: Metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const initialPage = await getReports().catch((error) => {
    console.error('Reports page failed', error);
    return null;
  });

  return <ReportFeed initialPage={initialPage} />;
}