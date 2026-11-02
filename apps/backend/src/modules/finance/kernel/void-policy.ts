import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

import { isAdminRole } from 'src/common/auth/utils/roles';
import { isSameCairoDay } from 'src/common/finance/cairo-date';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

/** Plan 3.1: a void needs a reason of at least 5 characters. */
export const VOID_REASON_MIN = 5;

/**
 * Who may void a payment, charge or revenue (plan 3.6). ADMIN and SUPER_ADMIN:
 * any entry. ACCOUNTANT: only their own entry, on the Cairo calendar day it
 * was created (an entry made at 23:30 Cairo can be voided until Cairo
 * midnight, whatever the server's UTC clock says). The "period still open"
 * part is the period lock, checked separately for every role. Anything else
 * is 403 `finance.error.voidNotAllowed`.
 */
export function assertCanVoid(
    actor: IAuthUser,
    entry: { createdById: string; createdAt: Date },
    now: Date = new Date()
): void {
    if (isAdminRole(actor.role)) return;
    if (
        actor.role === Role.ACCOUNTANT &&
        entry.createdById === actor.userId &&
        isSameCairoDay(entry.createdAt, now)
    )
        return;
    throw new ForbiddenException('finance.error.voidNotAllowed');
}
