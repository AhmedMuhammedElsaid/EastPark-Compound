import { NextResponse } from 'next/server';

import { forwardAdminWrite } from '@/lib/auth/admin.server';
import { announcementCreateSchema } from '@/lib/validation/admin';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = announcementCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });
  return forwardAdminWrite('/announcements', parsed.data);
}