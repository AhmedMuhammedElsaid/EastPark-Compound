import { NextRequest } from 'next/server';

import { forwardAdminRequest } from '@/lib/auth/admin.server';

const STATUSES = new Set(['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED']);

export function GET(request: NextRequest) {
  const params = new URLSearchParams({ limit: '50' });
  const cursor = request.nextUrl.searchParams.get('cursor');
  const status = request.nextUrl.searchParams.get('status');
  if (cursor) params.set('cursor', cursor);
  if (status && STATUSES.has(status)) params.set('status', status);
  return forwardAdminRequest(`/feedback?${params.toString()}`);
}