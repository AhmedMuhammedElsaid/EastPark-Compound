import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { isAdminRole } from 'src/common/auth/utils/roles';
import { DatabaseService } from 'src/common/database/services/database.service';
import { cursorArgs, toCursorPage } from 'src/common/helper/pagination';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { AuditAction, AuditEntity, AuditMeta } from './audit.actions';
import { ActivityQueryDto } from './dtos/activity.query.dto';
import { ActivityListResponseDto } from './dtos/activity.response.dto';

/**
 * Admin activity log. Services call `record()` AFTER the change succeeded.
 * Only ADMIN / SUPER_ADMIN actors are recorded, and a failed write is logged
 * and swallowed: the audit trail must never fail the request it describes.
 */
@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(private readonly db: DatabaseService) {}

    async record(
        actor: IAuthUser | undefined | null,
        action: AuditAction,
        entity: AuditEntity,
        entityId: string | null,
        meta: AuditMeta
    ): Promise<void> {
        if (!actor || !isAdminRole(actor.role)) return;
        try {
            await this.db.auditLog.create({
                data: {
                    userId: actor.userId,
                    action,
                    entity,
                    entityId,
                    meta: meta as Prisma.InputJsonObject,
                },
            });
        } catch (error) {
            const reason =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Audit write failed (${action} ${entity} ${entityId ?? '-'}): ${reason}`
            );
        }
    }

    /** `GET /admin/activity` — newest first, cursor-paginated. */
    async listActivity(
        query: ActivityQueryDto
    ): Promise<ActivityListResponseDto> {
        const limit = query.limit ?? 20;
        const rows = await this.db.auditLog.findMany({
            where: query.actorId ? { userId: query.actorId } : {},
            take: limit + 1,
            ...cursorArgs(query.cursor),
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: {
                id: true,
                action: true,
                entity: true,
                entityId: true,
                meta: true,
                createdAt: true,
                user: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
        });
        const { items, nextCursor } = toCursorPage(rows, limit);
        return {
            items: items.map(({ user, meta, ...row }) => ({
                ...row,
                meta:
                    meta && typeof meta === 'object' && !Array.isArray(meta)
                        ? (meta as Record<string, unknown>)
                        : null,
                actor: user,
            })),
            nextCursor,
        };
    }
}
