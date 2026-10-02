import { NextResponse } from 'next/server';

import { authUserEnvelopeSchema } from '@/lib/api/auth-schemas';
import { authenticatedBackendFetch, clearAuthCookies } from '@/lib/auth/server';
import { profileFormSchema, toProfileUpdate } from '@/lib/validation/profile';

export const maxDuration = 30;

function upstreamError(status: number): NextResponse {
  const safeStatus = [400, 401, 403, 404, 409, 422, 429].includes(status) ? status : 502;
  return NextResponse.json(
    { error: safeStatus === 401 ? 'unauthorized' : 'profile_request_failed' },
    { status: safeStatus },
  );
}

async function proxy(path: string, init?: RequestInit): Promise<NextResponse> {
  try {
    const response = await authenticatedBackendFetch(path, init ?? {}, { mutateCookies: true });
    if (!response) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    if (response.status === 204) return new NextResponse(null, { status: 204 });
    if (!response.ok) return upstreamError(response.status);

    const parsed = authUserEnvelopeSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) return upstreamError(502);
    return NextResponse.json(parsed.data);
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}

export async function GET() {
  return proxy('/user/profile');
}

export async function PUT(request: Request) {
  const parsed = profileFormSchema.strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  return proxy('/user', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toProfileUpdate(parsed.data)),
  });
}

export async function DELETE() {
  const response = await proxy('/user', { method: 'DELETE' });
  if (response.ok) await clearAuthCookies();
  return response;
}