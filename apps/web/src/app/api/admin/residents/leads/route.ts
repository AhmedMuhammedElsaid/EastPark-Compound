import { NextRequest } from 'next/server';

import { forwardAdminRequest } from '@/lib/auth/admin.server';

export const maxDuration = 30;

const STATUSES = new Set(['PENDING', 'INVITED', 'CONVERTED', 'REJECTED']);

export function GET(request: NextRequest) {
  const params = new URLSearchParams({ limit: '50' });
  const cursor = request.nextUrl.searchParams.get('cursor');
  const status = request.nextUrl.searchParams.get('status');
  if (cursor) params.set('cursor', cursor);
  const q = request.nextUrl.searchParams.get('q')?.trim().slice(0, 100);
  if (q) params.set('q', q);
  if (status && STATUSES.has(status)) params.set('status', status);
  return forwardAdminRequest(`/admin/residents/leads?${params.toString()}`);
}