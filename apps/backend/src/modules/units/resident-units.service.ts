import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    ListingStatus,
    OwnershipClosedReason,
    Prisma,
    ResidentLeadStatus,
} from '@prisma/client';

import {
    isPrismaError,
    PRISMA_UNIQUE_VIOLATION,
} from 'src/common/database/prisma-errors';
import { DatabaseService } from 'src/common/database/services/database.service';
import {
    isKnownFlat,
    normaliseFlatKey,
} from 'src/common/finance/compound-layout';
import { EmailService } from 'src/common/email/email.service';
import {
    FlatOwnershipService,
    OwnershipClient,
} from 'src/common/finance/flat-ownership.service';
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
        private readonly audit: AuditService,
        private readonly ownership: FlatOwnershipService
    ) {}

    /**
     * Every unit whose key normalises to `flat` (building/floor trimmed of
     * space/tab/CR/LF and upper-cased, flat number trimmed, the same expression
     * as the finance migration and `check-flat-keys.sql`). Matching on
     * the normalised form, not the exact text, lets a stored `a1` / `A1 ` row
     * count as the holder of `A1`: the unique index is case-sensitive, so an
     * exact lookup would let a second unit slip in and later abort the finance
     * migration. More than one row only when a collision already exists.
     */
    findHolders(
        flat: FlatKey,
        client: OwnershipClient = this.db
    ): Promise<{ id: string; userId: string }[]> {
        const key = normaliseFlatKey(flat);
        return client.$queryRaw<{ id: string; userId: string }[]>(
            Prisma.sql`SELECT "id", "userId" FROM "resident_units"
                WHERE upper(btrim("building", E' \\t\\r\\n')) = ${key.building}
                  AND upper(btrim("floor", E' \\t\\r\\n')) = ${key.floor}
                  AND btrim("flatNumber", E' \\t\\r\\n') = ${key.flatNumber}
                ORDER BY "createdAt" ASC`
        );
    }

    /** Current owner of a flat (normalised match), if any. */
    async findOwner(
        flat: FlatKey
    ): Promise<{ id: string; userId: string } | null> {
        const [holder] = await this.findHolders(flat);
        return holder ?? null;
    }

    /**
     * A PENDING/INVITED lead for the flat (normalised match), optionally
     * ignoring one lead id.
     */
    async findActiveLead(
        flat: FlatKey,
        exceptId?: string,
        client: OwnershipClient = this.db
    ): Promise<{ id: string } | null> {
        const key = normaliseFlatKey(flat);
        const rows = await client.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT "id" FROM "resident_leads"
                WHERE upper(btrim("building", E' \\t\\r\\n')) = ${key.building}
                  AND upper(btrim("floor", E' \\t\\r\\n')) = ${key.floor}
                  AND btrim("flatNumber", E' \\t\\r\\n') = ${key.flatNumber}
                  AND "status" IN ('PENDING', 'INVITED')
                  AND (${exceptId ?? null}::text IS NULL OR "id" <> ${exceptId ?? null})
                LIMIT 1`
        );
        return rows[0] ?? null;
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

        const activeLead = await this.findActiveLead(flat);
        if (activeLead)
            throw new ConflictException('residentLead.error.unitReserved');

        const label = formatUnitLabel(flat);
        let unit: Prisma.ResidentUnitGetPayload<{
            select: typeof RESIDENT_UNIT_SELECT;
        }>;
        try {
            unit = await this.db.$transaction(async tx => {
                // Held until commit: a concurrent delete cannot slip in between
                // this check and the new open period (review M1).
                const live = await this.ownership.lockUser(tx, user.id);
                if (!live || live.deletedAt)
                    throw new NotFoundException('user.error.notFound');
                const flatId = await this.ownership.resolveFlatId(tx, flat);
                const created = await tx.residentUnit.create({
                    data: {
                        userId: user.id,
                        building: flat.building,
                        floor: flat.floor,
                        flatNumber: flat.flatNumber,
                        addedById: actor.userId,
                        flatId,
                    },
                    select: RESIDENT_UNIT_SELECT,
                });
                if (flatId)
                    await this.ownership.openForNewUnit(tx, {
                        flatId,
                        userId: user.id,
                        actorId: actor.userId,
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
            // Lock order user → unit (as every ownership writer): a concurrent
            // restore cannot reopen this flat's period after we close it.
            await this.ownership.lockUser(tx, userId);
            // Row lock (same as updateKey): a concurrent re-key cannot move the
            // link between this read and the delete, so the period we close is
            // the one the row holds at delete time.
            const [locked] = await tx.$queryRaw<{ flatId: string | null }[]>(
                Prisma.sql`SELECT "flatId" FROM "resident_units" WHERE "id" = ${unit.id} AND "userId" = ${userId} FOR UPDATE`
            );
            if (!locked) throw new NotFoundException('unit.error.notFound');
            const removed = await tx.residentUnit.deleteMany({
                where: { id: unit.id, userId },
            });
            if (removed.count === 0)
                throw new NotFoundException('unit.error.notFound');

            // Path 4: the period closes with the row. A deleted owner's period
            // is already closed (ACCOUNT_DELETED), so this is then a no-op.
            if (locked.flatId)
                await this.ownership.closeForUnit(tx, {
                    flatId: locked.flatId,
                    userId,
                    reason: OwnershipClosedReason.REMOVED,
                    actorId: actor.userId,
                });

            // The flat is no longer theirs: an open listing for it would keep
            // holding the flat (partial unique index) against the next owner.
            await tx.listing.updateMany({
                where: {
                    ownerId: userId,
                    building: unit.building,
                    floor: unit.floor,
                    flatNumber: unit.flatNumber,
                    status: {
                        in: [ListingStatus.PENDING, ListingStatus.APPROVED],
                    },
                },
                data: { status: ListingStatus.WITHDRAWN },
            });

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

    /**
     * `PATCH /admin/resident-units/:id` [SUPER_ADMIN]: repairs the flat key of
     * an existing unit (a typo, `a1`, `Building A`). Re-keying moves ownership,
     * hence SUPER_ADMIN like add and remove. One transaction that first locks
     * the unit row (`FOR UPDATE`, so two PATCHes on one unit serialise), then
     * re-reads it and runs every check on the locked state: unknown flat 400
     * `unit.error.unknownFlat`; key held by another unit 409
     * `unit.error.alreadyOwned`; active lead 409 `residentLead.error.unitReserved`.
     * It updates the three text columns, follows the primary `unitNumber`,
     * withdraws the owner's open listings on the old key, and links the finance
     * flat: NULL → flat opens a period (sentinel or createdAt date), flat A →
     * flat B closes A as an empty period and opens B; no period for a
     * soft-deleted owner (restore opens it). Audited UNIT_KEY_CHANGED. A no-op
     * key still links an unlinked unit (the late-link path for a unit stored
     * while `FLAT_KEY_STRICT` was off).
     */
    async updateKey(
        unitId: string,
        key: FlatKey,
        actor: IAuthUser
    ): Promise<ResidentUnitDto> {
        const next = normaliseFlatKey(key);
        if (!isKnownFlat(next))
            throw new BadRequestException('unit.error.unknownFlat');
        const after = formatUnitLabel(next);

        let result: {
            row: Prisma.ResidentUnitGetPayload<{
                select: typeof RESIDENT_UNIT_SELECT;
            }>;
            before: string;
            userId: string;
            user: { name: string; email: string };
            changed: boolean;
        };
        try {
            result = await this.db.$transaction(async tx => {
                // Lock order user → unit: find the owner (a unit never changes
                // account), lock the user so deletedAt holds until commit,
                // then lock the unit row.
                const ref = await tx.residentUnit.findUnique({
                    where: { id: unitId },
                    select: { userId: true },
                });
                if (!ref) throw new NotFoundException('unit.error.notFound');
                await this.ownership.lockUser(tx, ref.userId);
                const locked = await tx.$queryRaw<{ id: string }[]>(
                    Prisma.sql`SELECT "id" FROM "resident_units" WHERE "id" = ${unitId} FOR UPDATE`
                );
                if (locked.length === 0)
                    throw new NotFoundException('unit.error.notFound');
                const unit = await tx.residentUnit.findUniqueOrThrow({
                    where: { id: unitId },
                    select: {
                        ...RESIDENT_UNIT_SELECT,
                        userId: true,
                        flatId: true,
                        user: {
                            select: { name: true, email: true, deletedAt: true },
                        },
                    },
                });
                const before = formatUnitLabel(unit);
                const sameText =
                    unit.building === next.building &&
                    unit.floor === next.floor &&
                    unit.flatNumber === next.flatNumber;

                if (!sameText) {
                    // Normalised match: a legacy `a1` row held by another unit counts too.
                    const holders = await this.findHolders(next, tx);
                    if (holders.some(holder => holder.id !== unit.id))
                        throw new ConflictException('unit.error.alreadyOwned');
                    if (await this.findActiveLead(next, undefined, tx))
                        throw new ConflictException(
                            'residentLead.error.unitReserved'
                        );
                }

                const flatId = await this.ownership.resolveFlatId(tx, next);
                if (sameText && unit.flatId === flatId)
                    return {
                        row: unit,
                        before,
                        userId: unit.userId,
                        user: unit.user,
                        changed: false,
                    };

                const row = sameText
                    ? unit
                    : await tx.residentUnit.update({
                          where: { id: unit.id },
                          data: {
                              building: next.building,
                              floor: next.floor,
                              flatNumber: next.flatNumber,
                          },
                          select: RESIDENT_UNIT_SELECT,
                      });
                if (!sameText) {
                    await tx.user.updateMany({
                        where: { id: unit.userId, unitNumber: before },
                        data: { unitNumber: after },
                    });
                    // The owner's open listings advertise the old key and hold
                    // `listings_active_unit_key` for it; withdraw them (as
                    // removeFromUser does) so the old flat is free again.
                    await tx.listing.updateMany({
                        where: {
                            ownerId: unit.userId,
                            building: unit.building,
                            floor: unit.floor,
                            flatNumber: unit.flatNumber,
                            status: {
                                in: [
                                    ListingStatus.PENDING,
                                    ListingStatus.APPROVED,
                                ],
                            },
                        },
                        data: { status: ListingStatus.WITHDRAWN },
                    });
                }

                if (flatId && unit.flatId !== flatId) {
                    const opts = {
                        userDeleted: unit.user.deletedAt !== null,
                        actorId: actor.userId,
                    };
                    if (unit.flatId)
                        await this.ownership.moveLink(
                            tx,
                            { ...unit, flatId: unit.flatId },
                            flatId,
                            opts
                        );
                    else
                        await this.ownership.linkAndOpen(tx, unit, flatId, opts);
                }
                return {
                    row,
                    before,
                    userId: unit.userId,
                    user: unit.user,
                    changed: true,
                };
            });
        } catch (error) {
            if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION))
                throw new ConflictException('unit.error.alreadyOwned');
            throw error;
        }

        if (result.changed)
            await this.audit.record(
                actor,
                'UNIT_KEY_CHANGED',
                'ResidentUnit',
                unitId,
                {
                    label: `${userLabel(result.user)} · ${result.before} → ${after}`,
                    userId: result.userId,
                    from: result.before,
                    to: after,
                }
            );

        return toResidentUnitDto(result.row);
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
