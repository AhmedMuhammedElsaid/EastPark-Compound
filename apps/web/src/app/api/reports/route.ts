import { NextRequest, NextResponse } from 'next/server';

import { getReports } from '@/lib/api/reports.server';

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get('cursor')?.trim() || undefined;

  try {
    const page = await getReports(cursor);
    return NextResponse.json({ data: page });
  } catch (error) {
    console.error('Reports proxy failed', error);
    return NextResponse.json({ error: 'Reports are temporarily unavailable.' }, { status: 502 });
  }
}