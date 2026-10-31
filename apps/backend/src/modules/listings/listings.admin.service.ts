import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Listing, ListingStatus, Prisma } from '@prisma/client';

import {
    isPrismaError,
    PRISMA_UNIQUE_VIOLATION,
} from 'src/common/database/prisma-errors';
import { DatabaseService } from 'src/common/database/services/database.service';
import { cursorArgs } from 'src/common/helper/pagination';
import { formatUnitLabel } from 'src/common/helper/utils/unit-label';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { AuditService } from 'src/modules/audit/audit.service';

import {
    ListingAdminQueryDto,
    ListingRevisionsQueryDto,
} from './dtos/request/listing.query.dto';
import {
    AdminListingDto,
    ListingStatsDto,
} from './dtos/response/listing.response.dto';
import { LISTING_VALIDITY_MS } from './listing.constants';
import {
    LISTING_ADMIN_OWNER_SELECT,
    toAdminListingDto,
    toListingPage,
    toRevisionDto,
} from './listing.mapper';
import { ListingNotifier } from './listing.notifier';
import { findActiveListingForFlat } from './listing.queries';

const ADMIN_INCLUDE = {
    owner: { select: LISTING_ADMIN_OWNER_SELECT },
    _count: { select: { revisions: true } },
} as const;

type AdminRow = Listing & {
    owner: { id: string; name: string; email: string; phone: string | null };
    _count: { revisions: number };
};

const toAdminDto = (row: AdminRow): AdminListingDto =>
    toAdminListingDto(row, row._count.revisions);

/** Admin search `q`: unit label, building or owner name, case-insensitive. */
export function listingSearchFilter(q: string): Prisma.ListingWhereInput[] {
    const branches: Prisma.ListingWhereInput[] = [
        { building: { contains: q, mode: 'insensitive' } },
        { owner: { name: { contains: q, mode: 'insensitive' } } },
    ];
    const parts = q.split('-').map(part => part.trim());
    if (parts.length === 3 && parts.every(Boolean)) {
        const [building, floor, flatNumber] = parts as [string, string, string];
        branches.push({
            building: { equals: building, mode: 'insensitive' },
            floor: { equals: floor, mode: 'insensitive' },
            flatNumber: { equals: flatNumber, mode: 'insensitive' },
        });
    }
    return branches;
}

@Injectable()
export class ListingsAdminService {
    constructor(
        private readonly db: DatabaseService,
        private readonly audit: AuditService,
        private readonly notifier: ListingNotifier
    ) {}

    async findAll(query: ListingAdminQueryDto) {
        const limit = query.limit ?? 20;
        const rows = await this.db.listing.findMany({
            where: {
                ...(query.status ? { status: query.status } : {}),
                ...(query.type ? { type: query.type } : {}),
                ...(query.q ? { OR: listingSearchFilter(query.q) } : {}),
            },
            include: ADMIN_INCLUDE,
            take: limit + 1,
            ...cursorArgs(query.cursor),
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        });
        return toListingPage(rows, limit, toAdminDto);
    }

    /** Counts per status (zero-filled) plus the total, from one `groupBy`. */
    async stats(): Promise<ListingStatsDto> {
        const groups = await this.db.listing.groupBy({
            by: ['status'],
            _count: { _all: true },
        });
        const counts: ListingStatsDto = {
            PENDING: 0,
            APPROVED: 0,
            REJECTED: 0,
            SOLD: 0,
            RENTED: 0,
            WITHDRAWN: 0,
            EXPIRED: 0,
            total: 0,
        };
        for (const group of groups) {
            counts[group.status] = group._count._all;
            counts.total += group._count._all;
        }
        return counts;
    }

    async findOne(id: string): Promise<AdminListingDto> {
        return toAdminDto(await this.loadOrThrow(id));
    }

    async revisions(id: string, query: ListingRevisionsQueryDto) {
        const exists = await this.db.listing.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!exists) throw new NotFoundException('listing.error.notFound');

        const limit = query.limit ?? 20;
        const rows = await this.db.listingRevision.findMany({
            where: { listingId: id },
            include: { editor: { select: { id: true, name: true } } },
            take: limit + 1,
            ...cursorArgs(query.cursor),
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        return toListingPage(rows, limit, toRevisionDto);
    }

    /** PENDING only. Re-checks the one-active-per-flat rule; fresh 60-day window. */
    async approve(id: string, actor: IAuthUser): Promise<AdminListingDto> {
        const current = await this.loadOrThrow(id);
        if (current.status !== ListingStatus.PENDING)
            throw new ConflictException('listing.error.invalidStatus');

        if (await findActiveListingForFlat(this.db, current, current.id))
            throw new ConflictException('listing.error.unitAlreadyListed');

        const now = new Date();
        const claimed = await this.claim(current.id, [ListingStatus.PENDING], {
            status: ListingStatus.APPROVED,
            approvedAt: now,
            expiresAt: new Date(now.getTime() + LISTING_VALIDITY_MS),
            rejectReason: null,
            reviewedById: actor.userId,
        });
        if (!claimed) throw new ConflictException('listing.error.invalidStatus');

        const unitLabel = formatUnitLabel(current);
        await this.audit.record(actor, 'LISTING_APPROVED', 'Listing', id, {
            label: `${current.type} ${unitLabel}`,
            unitLabel,
        });
        await this.notifier.notify('APPROVED', current.ownerId, id, unitLabel);

        return toAdminDto(await this.loadOrThrow(id));
    }

    /** PENDING → REJECTED, or APPROVED → REJECTED (take down). Reason is required. */
    async reject(
        id: string,
        reason: string,
        actor: IAuthUser
    ): Promise<AdminListingDto> {
        const current = await this.loadOrThrow(id);
        const takeDown = current.status === ListingStatus.APPROVED;
        if (!takeDown && current.status !== ListingStatus.PENDING)
            throw new ConflictException('listing.error.invalidStatus');

        const claimed = await this.claim(
            current.id,
            [current.status],
            {
                status: ListingStatus.REJECTED,
                rejectReason: reason,
                approvedAt: null,
                expiresAt: null,
                reviewedById: actor.userId,
            }
        );
        if (!claimed) throw new ConflictException('listing.error.invalidStatus');

        const unitLabel = formatUnitLabel(current);
        await this.audit.record(
            actor,
            takeDown ? 'LISTING_TAKEN_DOWN' : 'LISTING_REJECTED',
            'Listing',
            id,
            { label: `${current.type} ${unitLabel}`, unitLabel, reason }
        );
        await this.notifier.notify('REJECTED', current.ownerId, id, unitLabel);

        return toAdminDto(await this.loadOrThrow(id));
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private async loadOrThrow(id: string): Promise<AdminRow> {
        const row = await this.db.listing.findUnique({
            where: { id },
            include: ADMIN_INCLUDE,
        });
        if (!row) throw new NotFoundException('listing.error.notFound');
        return row;
    }

    /**
     * Compare-and-set on the status. Returns false when the row changed under
     * us; a unique-index race on the flat (approve) becomes the 409 the DB
     * index promises.
     */
    private async claim(
        id: string,
        from: ListingStatus[],
        data: Prisma.ListingUncheckedUpdateManyInput
    ): Promise<boolean> {
        try {
            const result = await this.db.listing.updateMany({
                where: { id, status: { in: from } },
                data,
            });
            return result.count === 1;
        } catch (error) {
            if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION))
                throw new ConflictException('listing.error.unitAlreadyListed');
            throw error;
        }
    }
}
