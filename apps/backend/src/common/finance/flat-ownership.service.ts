import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OwnershipClosedReason, Prisma, PrismaClient } from '@prisma/client';

import {
    isPrismaError,
    PRISMA_UNIQUE_VIOLATION,
} from 'src/common/database/prisma-errors';
import { FlatKey } from 'src/common/helper/utils/unit-label';

import { cairoDate, cairoToday, OWNERSHIP_SENTINEL_DATE } from './cairo-date';
import { isKnownFlat, normaliseFlatKey } from './compound-layout';

/** A transaction client or the root client (batch `$transaction([...])`). */
export type OwnershipClient = Prisma.TransactionClient | PrismaClient;

/** `finance_settings` key seeded by `20261102000000_finance_foundations`. */
export const FINANCE_GO_LIVE_KEY = 'finance.goLiveAt';

/**
 * Writes `FlatOwnership` periods (accounting plan 2.2). Every method runs on
 * the caller's transaction client, so the period and the `ResidentUnit` /
 * `User` change commit or roll back together. Invariant kept by the callers:
 * an open period for (flat, user) exists ⇔ a `ResidentUnit` with that `flatId`
 * exists for the user ⇔ the user is not soft-deleted. Units with
 * `flatId = NULL` (unknown key while `FLAT_KEY_STRICT` is off) are outside it.
 */
@Injectable()
export class FlatOwnershipService {
    private readonly logger = new Logger(FlatOwnershipService.name);

    constructor(private readonly config: ConfigService) {}

    private get strict(): boolean {
        return this.config.get<boolean>('app.flatKeyStrict') === true;
    }

    /**
     * The `Flat` id for a key (normalised match), or null for an unknown key.
     * With `FLAT_KEY_STRICT` on, an unknown key is 400 `unit.error.unknownFlat`.
     */
    async resolveFlatId(
        client: OwnershipClient,
        key: FlatKey
    ): Promise<string | null> {
        const norm = normaliseFlatKey(key);
        const flat = isKnownFlat(norm)
            ? await client.flat.findUnique({
                  where: {
                      building_floor_flatNumber: {
                          building: norm.building,
                          floor: norm.floor,
                          flatNumber: norm.flatNumber,
                      },
                  },
                  select: { id: true },
              })
            : null;
        if (flat) return flat.id;
        if (this.strict) throw new BadRequestException('unit.error.unknownFlat');
        return null;
    }

    /**
     * Opens a period for a unit created just now (paths 1 to 3), dated today
     * in Cairo. A second open period on the flat is 409 `unit.error.alreadyOwned`.
     */
    openForNewUnit(
        client: OwnershipClient,
        args: { flatId: string; userId: string; actorId?: string | null }
    ): Promise<void> {
        return this.open(client, { ...args, fromDate: cairoToday() });
    }

    /**
     * M2 "link and open period": `flatId` goes from NULL to a value on an
     * existing unit. Sets the link; opens a period only for a live owner, at
     * the 1900-01-01 sentinel when the unit predates finance go-live, else at
     * the unit's `createdAt` Cairo date.
     */
    async linkAndOpen(
        client: OwnershipClient,
        unit: { id: string; userId: string; createdAt: Date },
        flatId: string,
        opts: { userDeleted: boolean; actorId?: string | null }
    ): Promise<void> {
        await client.residentUnit.update({
            where: { id: unit.id },
            data: { flatId },
        });
        if (opts.userDeleted) return;
        await this.open(client, {
            flatId,
            userId: unit.userId,
            actorId: opts.actorId,
            fromDate: await this.linkFromDate(client, unit.createdAt),
        });
    }

    /**
     * A linked unit moved to another real flat (typo repair): the open period
     * on the old flat closes as an EMPTY period (`toDate = fromDate`, reason
     * REMOVED; the user never owned that flat), then the new flat is linked
     * and opened as in `linkAndOpen`.
     */
    async moveLink(
        client: OwnershipClient,
        unit: { id: string; userId: string; createdAt: Date; flatId: string },
        flatId: string,
        opts: { userDeleted: boolean; actorId?: string | null }
    ): Promise<void> {
        const open = await client.flatOwnership.findFirst({
            where: { flatId: unit.flatId, userId: unit.userId, toDate: null },
            select: { id: true, fromDate: true },
        });
        if (open)
            await client.flatOwnership.update({
                where: { id: open.id },
                data: {
                    toDate: open.fromDate,
                    closedReason: OwnershipClosedReason.REMOVED,
                    closedById: opts.actorId ?? null,
                },
            });
        await this.linkAndOpen(client, unit, flatId, opts);
    }

    /** Path 4: closes the user's open period on the flat today (no-op if none). */
    closeForUnit(
        client: OwnershipClient,
        args: {
            flatId: string;
            userId: string;
            reason: OwnershipClosedReason;
            actorId?: string | null;
        }
    ): Prisma.PrismaPromise<Prisma.BatchPayload> {
        return client.flatOwnership.updateMany({
            where: { flatId: args.flatId, userId: args.userId, toDate: null },
            data: {
                toDate: cairoToday(),
                closedReason: args.reason,
                closedById: args.actorId ?? null,
            },
        });
    }

    /**
     * Path 5 (account deletion): closes every open period of the user with
     * ACCOUNT_DELETED. Not async, so it can sit in a batch `$transaction([...])`.
     */
    closeAllForUser(
        client: OwnershipClient,
        userId: string,
        actorId?: string | null
    ): Prisma.PrismaPromise<Prisma.BatchPayload> {
        return client.flatOwnership.updateMany({
            where: { userId, toDate: null },
            data: {
                toDate: cairoToday(),
                closedReason: OwnershipClosedReason.ACCOUNT_DELETED,
                closedById: actorId ?? null,
            },
        });
    }

    /**
     * Path 6 (restore): opens a new period, dated the restore day, for every
     * linked unit the user still holds. Returns the reopened flat labels.
     */
    async reopenForUser(
        client: OwnershipClient,
        userId: string,
        actorId?: string | null
    ): Promise<string[]> {
        const units = await client.residentUnit.findMany({
            where: { userId, flatId: { not: null } },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: { flatId: true, flat: { select: { label: true } } },
        });
        const fromDate = cairoToday();
        const labels: string[] = [];
        for (const unit of units) {
            await this.open(client, {
                flatId: unit.flatId as string,
                userId,
                actorId,
                fromDate,
            });
            if (unit.flat) labels.push(unit.flat.label);
        }
        return labels;
    }

    private async open(
        client: OwnershipClient,
        args: {
            flatId: string;
            userId: string;
            fromDate: Date;
            actorId?: string | null;
        }
    ): Promise<void> {
        try {
            await client.flatOwnership.create({
                data: {
                    flatId: args.flatId,
                    userId: args.userId,
                    fromDate: args.fromDate,
                    openedById: args.actorId ?? null,
                },
            });
        } catch (error) {
            // `flat_ownership_one_open`: another open period holds the flat.
            if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION))
                throw new ConflictException('unit.error.alreadyOwned');
            throw error;
        }
    }

    private async linkFromDate(
        client: OwnershipClient,
        createdAt: Date
    ): Promise<Date> {
        const goLive = await this.goLiveAt(client);
        return goLive && createdAt >= goLive
            ? cairoDate(createdAt)
            : OWNERSHIP_SENTINEL_DATE;
    }

    /** Finance go-live instant, or null when the setting is missing/garbled. */
    async goLiveAt(client: OwnershipClient): Promise<Date | null> {
        const row = await client.financeSetting.findUnique({
            where: { key: FINANCE_GO_LIVE_KEY },
            select: { value: true },
        });
        const at =
            typeof row?.value === 'string' ? new Date(row.value) : null;
        if (!at || Number.isNaN(at.getTime())) {
            this.logger.warn(
                `${FINANCE_GO_LIVE_KEY} missing or invalid; late links use the 1900-01-01 sentinel`
            );
            return null;
        }
        return at;
    }
}
