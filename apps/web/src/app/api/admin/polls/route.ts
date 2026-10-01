import { NextResponse } from 'next/server';

import { forwardAdminWrite } from '@/lib/auth/admin.server';
import { pollCreateSchema } from '@/lib/validation/admin';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = pollCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });
  return forwardAdminWrite('/polls', parsed.data);
}