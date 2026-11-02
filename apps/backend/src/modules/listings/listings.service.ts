import {
    BadRequestException,
    ConflictException,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Listing, ListingStatus, ListingType, Prisma } from '@prisma/client';

import { CacheService } from 'src/common/cache/services/cache.service';
import {
    isPrismaError,
    PRISMA_UNIQUE_VIOLATION,
} from 'src/common/database/prisma-errors';
import { DatabaseService } from 'src/common/database/services/database.service';
import { FlatOwnershipService } from 'src/common/finance/flat-ownership.service';
import { cursorArgs } from 'src/common/helper/pagination';
import { FlatKey, formatUnitLabel } from 'src/common/helper/utils/unit-label';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { ResidentUnitsService } from 'src/modules/units/resident-units.service';

import {
    ListingBrowseQueryDto,
    ListingMineQueryDto,
} from './dtos/request/listing.query.dto';
import { ListingUpsertDto } from './dtos/request/listing.upsert.dto';
import {
    ListingDto,
    MyListingDto,
} from './dtos/response/listing.response.dto';
import {
    LISTING_CREATE_LIMIT,
    LISTING_CREATE_WINDOW_SECONDS,
    LISTING_VALIDITY_MS,
    OWNER_EDITABLE_STATUSES,
} from './listing.constants';
import { diffListing, normalizeFields, toFields } from './listing.diff';
import {
    LISTING_OWNER_SELECT,
    toListingDto,
    toListingPage,
    toMyListingDto,
} from './listing.mapper';
import { ListingNotifier } from './listing.notifier';
import { assertListingPhotos } from './listing.photos';
import { findActiveListingForFlat, visibleListingWhere } from './listing.queries';

type ListingWithOwner = Listing & { owner: { id: string; name: string } };

const WITH_OWNER = { owner: { select: LISTING_OWNER_SELECT } } as const;

@Injectable()
export class ListingsService {
    private readonly logger = new Logger(ListingsService.name);

    constructor(
        private readonly db: DatabaseService,
        private readonly config: ConfigService,
        private readonly cache: CacheService,
        private readonly notifier: ListingNotifier,
        private readonly units: ResidentUnitsService,
        private readonly ownership: FlatOwnershipService
    ) {}

    // ── Browse ────────────────────────────────────────────────────────────────

    /** APPROVED + unexpired, newest approval first. Soft-deleted owners are hidden. */
    async browse(query: ListingBrowseQueryDto) {
        const limit = query.limit ?? 20;
        const rows = await this.db.listing.findMany({
            where: {
                ...visibleListingWhere(new Date()),
                ...(query.type ? { type: query.type } : {}),
            },
            include: WITH_OWNER,
            take: limit + 1,
            ...cursorArgs(query.cursor),
            orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
        });
        return toListingPage(rows, limit, toListingDto);
    }

    /** The caller's own listings, every status, newest first. */
    async mine(actor: IAuthUser, query: ListingMineQueryDto) {
        const limit = query.limit ?? 20;
        const rows = await this.db.listing.findMany({
            where: {
                ownerId: actor.userId,
                ...(query.status ? { status: query.status } : {}),
            },
            include: WITH_OWNER,
            take: limit + 1,
            ...cursorArgs(query.cursor),
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        return toListingPage(rows, limit, toMyListingDto);
    }

    /**
     * Visible-approved listings for everyone; the OWNER also gets their own
     * listing in any status (as `MyListingDto`). Anything else is a 404.
     */
    async findOne(
        id: string,
        actor: IAuthUser
    ): Promise<ListingDto | MyListingDto> {
        const row = await this.db.listing.findUnique({
            where: { id },
            include: {
                owner: { select: { ...LISTING_OWNER_SELECT, deletedAt: true } },
            },
        });
        if (!row) throw new NotFoundException('listing.error.notFound');

        if (row.ownerId === actor.userId) return toMyListingDto(row);

        const visible =
            row.status === ListingStatus.APPROVED &&
            row.expiresAt !== null &&
            row.expiresAt > new Date() &&
            row.owner.deletedAt === null;
        // Admins see the same public view here; they moderate through /admin/listings.
        if (!visible) throw new NotFoundException('listing.error.notFound');
        return toListingDto(row);
    }

    // ── Create / edit ─────────────────────────────────────────────────────────

    async create(dto: ListingUpsertDto, actor: IAuthUser): Promise<MyListingDto> {
        await this.assertUnderCreateCap(actor.userId);

        const fields = normalizeFields(dto);
        assertListingPhotos(this.config, fields.photos);
        await this.assertOwnsFlat(actor.userId, fields);

        if (await findActiveListingForFlat(this.db, fields))
            throw new ConflictException('listing.error.unitAlreadyListed');

        // Informational finance link (plan 2.2); never decides who may list.
        const flatId = await this.ownership.resolveFlatId(this.db, fields);

        try {
            const row = await this.db.listing.create({
                data: {
                    ...fields,
                    flatId,
                    price: new Prisma.Decimal(fields.price),
                    status: ListingStatus.PENDING,
                    ownerId: actor.userId,
                },
                include: WITH_OWNER,
            });
            // Only a successful create counts toward the cap.
            await this.countCreate(actor.userId);
            return toMyListingDto(row);
        } catch (error) {
            throw this.mapUnique(error);
        }
    }

    /**
     * Complete replacement by the owner. PENDING / APPROVED / REJECTED go back
     * to PENDING (approval, expiry and reject reason cleared) and one revision
     * row is written with only the changed fields plus the previous values.
     */
    async update(
        id: string,
        dto: ListingUpsertDto,
        actor: IAuthUser
    ): Promise<MyListingDto> {
        const current = await this.ownedOrThrow(id, actor);
        if (!OWNER_EDITABLE_STATUSES.includes(current.status))
            throw new ConflictException('listing.error.invalidStatus');

        const previous = toFields(current);
        const next = normalizeFields(dto);
        assertListingPhotos(this.config, next.photos, previous.photos);
        // Every edit, so a flat removed from the account cannot be re-submitted.
        await this.assertOwnsFlat(actor.userId, next);

        const changes = diffListing(previous, next);
        if (changes.length === 0)
            throw new BadRequestException('listing.error.noChanges');

        const flatChanged =
            previous.building !== next.building ||
            previous.floor !== next.floor ||
            previous.flatNumber !== next.flatNumber;
        // Re-checked on every edit that moves the flat. An edit that keeps it
        // already holds the slot (PENDING/APPROVED) or, from REJECTED, must
        // re-acquire it, so REJECTED is always checked.
        if (
            (flatChanged || current.status === ListingStatus.REJECTED) &&
            (await findActiveListingForFlat(this.db, next, current.id))
        )
            throw new ConflictException('listing.error.unitAlreadyListed');

        const flatId = await this.ownership.resolveFlatId(this.db, next);

        try {
            const row = await this.db.$transaction(async tx => {
                // Compare-and-set on the status read above: a concurrent
                // withdraw / close / expiry must not be silently reopened.
                const claimed = await tx.listing.updateMany({
                    where: {
                        id: current.id,
                        status: current.status,
                    },
                    data: {
                        ...next,
                        flatId,
                        price: new Prisma.Decimal(next.price),
                        status: ListingStatus.PENDING,
                        approvedAt: null,
                        expiresAt: null,
                        rejectReason: null,
                    },
                });
                if (claimed.count !== 1)
                    throw new ConflictException('listing.error.invalidStatus');

                await tx.listingRevision.create({
                    data: {
                        listingId: current.id,
                        editorId: actor.userId,
                        changes: changes as unknown as Prisma.InputJsonArray,
                        snapshot: previous as unknown as Prisma.InputJsonObject,
                    },
                });

                return tx.listing.findUniqueOrThrow({
                    where: { id: current.id },
                    include: WITH_OWNER,
                });
            });
            return toMyListingDto(row);
        } catch (error) {
            throw this.mapUnique(error);
        }
    }

    // ── Owner status actions ──────────────────────────────────────────────────

    /** APPROVED only: a fresh 60-day window, no re-review. */
    async renew(id: string, actor: IAuthUser): Promise<MyListingDto> {
        const current = await this.ownedOrThrow(id, actor);
        return this.transition(
            current,
            [ListingStatus.APPROVED],
            { expiresAt: new Date(Date.now() + LISTING_VALIDITY_MS) },
            { expiresAt: { gt: new Date() } }
        );
    }

    /** APPROVED only: SALE becomes SOLD, RENT becomes RENTED. */
    async close(id: string, actor: IAuthUser): Promise<MyListingDto> {
        const current = await this.ownedOrThrow(id, actor);
        return this.transition(
            current,
            [ListingStatus.APPROVED],
            {
                status:
                    current.type === ListingType.SALE
                        ? ListingStatus.SOLD
                        : ListingStatus.RENTED,
            },
            // Past `expiresAt` the hourly cron owns the row (-> EXPIRED).
            { expiresAt: { gt: new Date() } }
        );
    }

    /** PENDING / APPROVED / REJECTED. */
    async withdraw(id: string, actor: IAuthUser): Promise<MyListingDto> {
        const current = await this.ownedOrThrow(id, actor);
        return this.transition(current, OWNER_EDITABLE_STATUSES, {
            status: ListingStatus.WITHDRAWN,
        });
    }

    // ── Expiry cron ───────────────────────────────────────────────────────────

    /** Hourly: APPROVED listings past `expiresAt` become EXPIRED and notify the owner. */
    @Cron('0 * * * *')
    async expireDue(now: Date = new Date()): Promise<number> {
        const due = await this.db.listing.findMany({
            where: {
                status: ListingStatus.APPROVED,
                expiresAt: { lte: now },
            },
            select: {
                id: true,
                ownerId: true,
                building: true,
                floor: true,
                flatNumber: true,
            },
        });

        let expired = 0;
        for (const listing of due) {
            // Compare-and-set per row: an owner who closed or renewed it since
            // the read above must not be overwritten.
            const claimed = await this.db.listing.updateMany({
                where: {
                    id: listing.id,
                    status: ListingStatus.APPROVED,
                    expiresAt: { lte: now },
                },
                data: { status: ListingStatus.EXPIRED },
            });
            if (claimed.count !== 1) continue;
            expired += 1;
            await this.notifier.notify(
                'EXPIRED',
                listing.ownerId,
                listing.id,
                formatUnitLabel(listing)
            );
        }

        if (expired > 0)
            this.logger.log(`Expired ${expired} listing(s)`);
        return expired;
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** Owner-only lookup; a missing or foreign listing is the same 404. */
    private async ownedOrThrow(id: string, actor: IAuthUser): Promise<Listing> {
        const row = await this.db.listing.findUnique({ where: { id } });
        if (!row || row.ownerId !== actor.userId)
            throw new NotFoundException('listing.error.notFound');
        return row;
    }

    /**
     * Compare-and-set status change: applies `data` only while the row still has
     * one of the `allowed` statuses (and matches `extraWhere`), else 409
     * `listing.error.invalidStatus`.
     */
    private async transition(
        current: Listing,
        allowed: readonly ListingStatus[],
        data: Prisma.ListingUpdateManyMutationInput,
        extraWhere: Prisma.ListingWhereInput = {}
    ): Promise<MyListingDto> {
        if (!allowed.includes(current.status))
            throw new ConflictException('listing.error.invalidStatus');

        const claimed = await this.db.listing.updateMany({
            where: { id: current.id, status: { in: [...allowed] }, ...extraWhere },
            data,
        });
        if (claimed.count !== 1)
            throw new ConflictException('listing.error.invalidStatus');

        const row: ListingWithOwner = await this.db.listing.findUniqueOrThrow({
            where: { id: current.id },
            include: WITH_OWNER,
        });
        return toMyListingDto(row);
    }

    /**
     * The caller must own the flat: its `resident_units` row is theirs, or,
     * for a legacy account with no rows at all, the flat label equals the
     * trimmed `User.unitNumber` (same fallback as order delivery units).
     */
    private async assertOwnsFlat(userId: string, flat: FlatKey): Promise<void> {
        const owner = await this.units.findOwner(flat);
        if (owner) {
            if (owner.userId === userId) return;
            throw new BadRequestException('listing.error.unitNotOwned');
        }
        const user = await this.db.user.findUnique({
            where: { id: userId },
            select: {
                unitNumber: true,
                _count: { select: { residentUnits: true } },
            },
        });
        if (
            user &&
            user._count.residentUnits === 0 &&
            user.unitNumber?.trim() === formatUnitLabel(flat)
        )
            return;
        throw new BadRequestException('listing.error.unitNotOwned');
    }

    private createCapKey(userId: string): string {
        return `listing-create:${userId}`;
    }

    /**
     * 5 successful creates per user per hour. Read-only check before the work;
     * the counter is bumped after the insert (`countCreate`), so failed
     * attempts (409 / 400) never burn the quota. A small overshoot under
     * concurrency is accepted.
     */
    private async assertUnderCreateCap(userId: string): Promise<void> {
        const created = await this.cache.get<number>(this.createCapKey(userId));
        if (Number(created ?? 0) >= LISTING_CREATE_LIMIT)
            throw new HttpException(
                'listing.error.tooManyCreated',
                HttpStatus.TOO_MANY_REQUESTS
            );
    }

    private async countCreate(userId: string): Promise<void> {
        await this.cache.incrWithTtl(
            this.createCapKey(userId),
            LISTING_CREATE_WINDOW_SECONDS
        );
    }

    private mapUnique(error: unknown): unknown {
        if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION))
            return new ConflictException('listing.error.unitAlreadyListed');
        return error;
    }
}
