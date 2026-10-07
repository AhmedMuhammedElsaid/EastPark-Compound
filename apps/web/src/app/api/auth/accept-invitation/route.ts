import { NextResponse } from 'next/server';

import { readAuthResponse } from '@/lib/api/auth-schemas';
import { knownBackendErrorCode } from '@/lib/api/bff-errors';
import { backendFetch, clientIpFrom, setAuthCookies } from '@/lib/auth/server';
import { acceptInvitationSchema } from '@/lib/validation/auth';

export const maxDuration = 30;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = acceptInvitationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  try {
    const response = await backendFetch('/auth/accept-invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    }, { clientIp: clientIpFrom(request.headers) });

    if (!response.ok) {
      if (response.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
      if (response.status === 409) {
        // The email belongs to a soft-deleted account: no password helps, only the administration.
        const code = await knownBackendErrorCode(response);
        if (code === 'account_deleted') {
          return NextResponse.json({ error: 'account_deleted' }, { status: 409 });
        }
        // The invited flat already belongs to another account; the invitation stays unused.
        if (code === 'unit_already_owned') {
          return NextResponse.json({ error: 'unit_already_owned' }, { status: 409 });
        }
        // Otherwise the email already has an account and the password is not its current one.
        return NextResponse.json({ error: 'account_exists' }, { status: 409 });
      }
      if (response.status === 400 || response.status === 404) {
        return NextResponse.json({ error: 'invalid_invitation' }, { status: 400 });
      }
      return NextResponse.json({ error: 'server' }, { status: response.status >= 500 ? response.status : 400 });
    }

    const auth = await readAuthResponse(response);
    if (!auth) {
      console.error('Auth response contract mismatch', { endpoint: '/auth/accept-invitation' });
      return NextResponse.json({ error: 'server' }, { status: 502 });
    }
    await setAuthCookies(auth);
    return NextResponse.json({ data: { user: auth.user } });
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}