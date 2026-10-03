import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ReportDetailView } from '@/components/app/ReportDetailView';
import { getReport, ReportRequestError } from '@/lib/api/reports.server';
import { requestClientIp } from '@/lib/auth/server';

export const metadata: Metadata = { title: 'تقرير' };

type ReportDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { id } = await params;
  const report = await getReport(id, { clientIp: await requestClientIp() }).catch((error) => {
    if (error instanceof ReportRequestError && error.status === 404) notFound();
    console.error('Report detail page failed', error);
    return null;
  });

  return <ReportDetailView report={report} />;
}