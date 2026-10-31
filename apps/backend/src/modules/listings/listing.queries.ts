import { Prisma } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { FlatKey } from 'src/common/helper/utils/unit-label';

import { ACTIVE_LISTING_STATUSES } from './listing.constants';

/** Other ACTIVE (PENDING / APPROVED) listing holding the same flat, if any. */
export function findActiveListingForFlat(
    db: Pick<DatabaseService, 'listing'>,
    flat: FlatKey,
    excludeId?: string
): Promise<{ id: string } | null> {
    return db.listing.findFirst({
        where: {
            building: flat.building,
            floor: flat.floor,
            flatNumber: flat.flatNumber,
            status: { in: ACTIVE_LISTING_STATUSES },
            ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
    });
}

/** Browse visibility: APPROVED, unexpired, owner not soft-deleted. */
export function visibleListingWhere(now: Date): Prisma.ListingWhereInput {
    return {
        status: 'APPROVED',
        expiresAt: { gt: now },
        owner: { deletedAt: null },
    };
}
