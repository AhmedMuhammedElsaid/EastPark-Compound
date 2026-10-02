import { NextResponse } from 'next/server';

import { forwardAdminWrite } from '@/lib/auth/admin.server';
import { electionCreateSchema } from '@/lib/validation/admin';

export const maxDuration = 30;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = electionCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });
  return forwardAdminWrite('/elections', parsed.data);
}