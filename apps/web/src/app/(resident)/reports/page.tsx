import type { Metadata } from 'next';

import { ReportFeed } from '@/components/app/ReportFeed';
import { getReports } from '@/lib/api/reports.server';
import { requestClientIp } from '@/lib/auth/server';

export const metadata: Metadata = { title: 'التقارير' };
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const initialPage = await getReports(undefined, { clientIp: await requestClientIp() }).catch((error) => {
    console.error('Reports page failed', error);
    return null;
  });

  return <ReportFeed initialPage={initialPage} />;
}