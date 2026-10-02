import { NextResponse } from 'next/server';

import { getReport, ReportRequestError } from '@/lib/api/reports.server';
import { clientIpFrom } from '@/lib/auth/server';

export const maxDuration = 30;

type ReportRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: ReportRouteContext) {
  const { id } = await params;

  try {
    const report = await getReport(id, { clientIp: clientIpFrom(request.headers) });
    return NextResponse.json({ data: report });
  } catch (error) {
    if (error instanceof ReportRequestError && error.status === 404) {
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
    }

    console.error('Report detail proxy failed', error);
    return NextResponse.json({ error: 'Report is temporarily unavailable.' }, { status: 502 });
  }
}