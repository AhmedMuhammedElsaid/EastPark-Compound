import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import {
    AuditMeta,
    FinanceAuditAction,
    FinanceAuditEntity,
} from 'src/modules/audit/audit.actions';

import { FinanceTx } from './finance-tx';

/**
 * Finance audit writer (plan 3.7). Unlike `AuditService.record()`, it:
 * - writes on the posting's transaction client, so a failed audit insert
 *   rolls the posting back (no money change without its audit row);
 * - records every role that reaches finance (ACCOUNTANT included);
 * - never catches: the request fails and the client retries with the same
 *   idempotency key.
 * `meta` carries ids, the flat label, amounts as 2-dp strings, old/new values
 * and void reasons. It is shown to accountants on `/finance/audit`, so it must
 * NEVER carry an email, national id, passport number or phone (do not copy
 * the admin feed's "Name (email)" label style); a unit test checks the
 * charge paths.
 */
@Injectable()
export class FinanceAuditService {
    async record(
        tx: FinanceTx,
        actor: IAuthUser,
        action: FinanceAuditAction,
        entity: FinanceAuditEntity,
        entityId: string | null,
        meta: AuditMeta
    ): Promise<void> {
        await tx.auditLog.create({
            data: {
                userId: actor.userId,
                action,
                entity,
                entityId,
                meta: meta as Prisma.InputJsonObject,
            },
        });
    }
}
