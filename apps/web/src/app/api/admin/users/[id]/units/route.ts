import { NextResponse } from 'next/server';

import { forwardSuperAdminRequest } from '@/lib/auth/admin.server';
import { unitFieldsSchema } from '@/lib/schemas/registerUnit';
import { userIdSchema } from '@/lib/validation/super-admin';

export const maxDuration = 30;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Adds a flat to an existing account (SUPER_ADMIN only) → backend `POST /v1/admin/user/:id/units`.
 * A 409 for a flat owned by someone (`unit.error.alreadyOwned`) arrives as the known code
 * `unit_already_owned`; any other 409 is the flat being in an active application.
 */
const ERROR_CODES = {
  400: 'unit_validation',
  404: 'not_found',
  409: 'unit_reserved',
} as const;

export async function POST(request: Request, { params }: RouteContext) {
  const id = userIdSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: 'unit_validation' }, { status: 400 });

  const body: unknown = await request.json().catch(() => undefined);
  // Same building / floor / flat rules as /register-unit (incl. the floor-for-building check the
  // backend does not enforce).
  const parsed = unitFieldsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'unit_validation' }, { status: 400 });

  return forwardSuperAdminRequest(
    `/admin/user/${encodeURIComponent(id.data)}/units`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        building: parsed.data.building,
        floor: parsed.data.floor,
        flatNumber: parsed.data.flatNumber,
      }),
      signal: AbortSignal.timeout(25_000),
    },
    ERROR_CODES,
  );
}
