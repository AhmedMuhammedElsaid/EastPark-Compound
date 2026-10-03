import { NextResponse } from 'next/server';

import { bffErrorResponse } from '@/lib/api/bff-errors';
import { getReport } from '@/lib/api/reports.server';
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
    return bffErrorResponse(error, 'Report detail proxy failed');
  }
}
