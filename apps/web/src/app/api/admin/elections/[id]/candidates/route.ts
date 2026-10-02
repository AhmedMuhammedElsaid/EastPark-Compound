import { NextResponse } from 'next/server';

import { forwardAdminWrite } from '@/lib/auth/admin.server';
import { candidateCreateSchema } from '@/lib/validation/admin';

export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null);
  const parsed = candidateCreateSchema.omit({ electionId: true }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  const { id } = await params;
  if (!id || id.length > 200) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  return forwardAdminWrite(`/elections/${encodeURIComponent(id)}/candidates`, parsed.data);
}