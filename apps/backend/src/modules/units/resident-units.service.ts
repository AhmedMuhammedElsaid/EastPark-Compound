import {
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, ResidentLeadStatus } from '@prisma/client';

import {
    isPrismaError,
    PRISMA_UNIQUE_VIOLATION,
} from 'src/common/database/prisma-errors';
import { DatabaseService } from 'src/common/database/services/database.service';
import { EmailService } from 'src/common/email/email.service';
import { FlatKey, formatUnitLabel } from 'src/common/helper/utils/unit-label';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { ApiGenericResponseDto } from 'src/common/response/dtos/response.generic.dto';
import { AuditService } from 'src/modules/audit/audit.service';

import {
    RESIDENT_UNIT_ORDER,
    RESIDENT_UNIT_SELECT,
    ResidentUnitDto,
    toResidentUnitDto,
} from './dtos/resident-unit.dto';

/** Legacy anonymised tombstones (see user.service) are never targets. */
const DELETED_USER_EMAIL_DOMAIN = '@deleted.invalid';

const userLabel = (user: { name: string; email: string }): string =>
    `${user.name} (${user.email})`;

/** Active application for a flat = a PENDING or INVITED lead. */
export const ACTIVE_LEAD_STATUSES = [
    ResidentLeadStatus.PENDING,
    ResidentLeadStatus.INVITED,
];

/**
 * Flats owned by accounts (multi-flat owners, 2026-10-07). One account can own
 * many flats; a flat has at most one owner (`resident_units` unique key).
 * `User.unitNumber` stays the PRIMARY flat label for old mobile builds.
 */
@Injectable()
export class ResidentUnitsService {
    private readonly logger = new Logger(ResidentUnitsService.name);

    constructor(
        private readonly db: DatabaseService,
        private readonly email: EmailService,
        private readonly audit: AuditService
    ) {}

    /** Current owner of a flat, if any. */
    findOwner(flat: FlatKey): Promise<{ id: string; userId: string } | null> {
        return this.db.residentUnit.findUnique({
            where: {
                building_floor_flatNumber: {
                    building: flat.building,
                    floor: flat.floor,
                    flatNumber: flat.flatNumber,
                },
            },
            select: { id: true, userId: true },
        });
    }

    /**
     * `POST /admin/user/:id/units` [SUPER_ADMIN]: adds a flat to an existing,
     * live account. 404 `user.error.notFound`; 409 `unit.error.alreadyOwned`
     * (any owner, this account included); 409 `residentLead.error.unitReserved`
     * (a PENDING/INVITED lead for the flat). Sets `unitNumber` when it is null,
     * audits UNIT_ADDED and mails the owner (best-effort).
     */
    async addToUser(
        userId: string,
        flat: FlatKey,
        actor: IAuthUser
    ): Promise<ResidentUnitDto> {
        const user = await this.db.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, deletedAt: true },
        });
        if (
            !user ||
            user.deletedAt ||
            user.email.endsWith(DELETED_USER_EMAIL_DOMAIN)
        )
            throw new NotFoundException('user.error.notFound');

        if (await this.findOwner(flat))
            throw new ConflictException('unit.error.alreadyOwned');

        const activeLead = await this.db.residentLead.findFirst({
            where: {
                building: flat.building,
                floor: flat.floor,
                flatNumber: flat.flatNumber,
                status: { in: ACTIVE_LEAD_STATUSES },
            },
            select: { id: true },
        });
        if (activeLead)
            throw new ConflictException('residentLead.error.unitReserved');

        const label = formatUnitLabel(flat);
        let unit: Prisma.ResidentUnitGetPayload<{
            select: typeof RESIDENT_UNIT_SELECT;
        }>;
        try {
            unit = await this.db.$transaction(async tx => {
                const created = await tx.residentUnit.create({
                    data: {
                        userId: user.id,
                        building: flat.building,
                        floor: flat.floor,
                        flatNumber: flat.flatNumber,
                        addedById: actor.userId,
                    },
                    select: RESIDENT_UNIT_SELECT,
                });
                await tx.user.updateMany({
                    where: { id: user.id, unitNumber: null },
                    data: { unitNumber: label },
                });
                return created;
            });
        } catch (error) {
            if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION))
                throw new ConflictException('unit.error.alreadyOwned');
            throw error;
        }

        await this.audit.record(actor, 'UNIT_ADDED', 'ResidentUnit', unit.id, {
            label: `${userLabel(user)} · ${label}`,
            userId: user.id,
            unit: label,
        });

        await this.notifyAdded(user, label);

        return toResidentUnitDto(unit);
    }

    /**
     * `DELETE /admin/user/:id/units/:unitId` [SUPER_ADMIN]: hard-deletes the
     * flat row (sale / transfer), also for a soft-deleted account. 404
     * `unit.error.notFound` when the unit is missing or belongs to another
     * account. When the removed flat was the primary (`unitNumber`), the
     * oldest remaining flat becomes primary, or null. Audited UNIT_REMOVED.
     */
    async removeFromUser(
        userId: string,
        unitId: string,
        actor: IAuthUser
    ): Promise<ApiGenericResponseDto> {
        const unit = await this.db.residentUnit.findUnique({
            where: { id: unitId },
            select: {
                ...RESIDENT_UNIT_SELECT,
                userId: true,
                user: { select: { name: true, email: true, unitNumber: true } },
            },
        });
        if (!unit || unit.userId !== userId)
            throw new NotFoundException('unit.error.notFound');

        const label = formatUnitLabel(unit);

        await this.db.$transaction(async tx => {
            const removed = await tx.residentUnit.deleteMany({
                where: { id: unit.id, userId },
            });
            if (removed.count === 0)
                throw new NotFoundException('unit.error.notFound');

            const owner = await tx.user.findUnique({
                where: { id: userId },
                select: { unitNumber: true },
            });
            if (owner?.unitNumber !== label) return;

            const next = await tx.residentUnit.findFirst({
                where: { userId },
                orderBy: RESIDENT_UNIT_ORDER,
                select: RESIDENT_UNIT_SELECT,
            });
            await tx.user.update({
                where: { id: userId },
                data: { unitNumber: next ? formatUnitLabel(next) : null },
            });
        });

        await this.audit.record(
            actor,
            'UNIT_REMOVED',
            'ResidentUnit',
            unit.id,
            {
                label: `${userLabel(unit.user)} · ${label}`,
                userId,
                unit: label,
            }
        );

        return { success: true, message: 'unit.success.removed' };
    }

    /** "Flat added to your account" email. Never fails the caller. */
    async notifyAdded(
        user: { name: string; email: string },
        label: string
    ): Promise<void> {
        try {
            await this.email.sendUnitAdded(user.email, user.name, label);
        } catch (error) {
            const reason =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(`Unit-added email not sent (${label}): ${reason}`);
        }
    }
}
