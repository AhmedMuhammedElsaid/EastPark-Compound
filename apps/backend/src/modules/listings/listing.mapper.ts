import { Listing } from '@prisma/client';

import { toMoneyNumber } from 'src/common/helper/money';
import { toCursorPage } from 'src/common/helper/pagination';
import { formatUnitLabel } from 'src/common/helper/utils/unit-label';

import {
    AdminListingDto,
    ListingDto,
    ListingRevisionDto,
    MyListingDto,
} from './dtos/response/listing.response.dto';
import { ListingChange } from './listing.diff';

type ListingOwnerRow = { id: string; name: string };
type ListingAdminOwnerRow = ListingOwnerRow & {
    email: string;
    phone: string | null;
};

/** `select` for the owner on public / owner reads: id + name only, never contact data. */
export const LISTING_OWNER_SELECT = { id: true, name: true } as const;

/** `select` for the owner on admin reads. */
export const LISTING_ADMIN_OWNER_SELECT = {
    id: true,
    name: true,
    email: true,
    phone: true,
} as const;

export function toListingDto(
    row: Listing & { owner: ListingOwnerRow }
): ListingDto {
    return {
        id: row.id,
        type: row.type,
        status: row.status,
        building: row.building,
        floor: row.floor,
        flatNumber: row.flatNumber,
        unitLabel: formatUnitLabel(row),
        price: toMoneyNumber(row.price),
        areaSqm: row.areaSqm,
        bedrooms: row.bedrooms,
        bathrooms: row.bathrooms,
        furnished: row.furnished,
        description: row.description,
        contactPhone: row.contactPhone,
        photos: row.photos,
        approvedAt: row.approvedAt,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        owner: { id: row.owner.id, name: row.owner.name },
    };
}

export function toMyListingDto(
    row: Listing & { owner: ListingOwnerRow }
): MyListingDto {
    return { ...toListingDto(row), rejectReason: row.rejectReason };
}

export function toAdminListingDto(
    row: Listing & { owner: ListingAdminOwnerRow },
    revisionCount: number
): AdminListingDto {
    return {
        ...toMyListingDto(row),
        owner: {
            id: row.owner.id,
            name: row.owner.name,
            email: row.owner.email,
            phone: row.owner.phone,
        },
        revisionCount,
    };
}

/** Shared `{ items, nextCursor }` envelope; the contract uses `null` (not absent) for "no more". */
export function toListingPage<T, R extends { id: string }>(
    rows: R[],
    limit: number,
    map: (row: R) => T
): { items: T[]; nextCursor: string | null } {
    const { items, nextCursor } = toCursorPage(rows, limit);
    return { items: items.map(row => map(row)), nextCursor: nextCursor ?? null };
}

export function toRevisionDto(row: {
    id: string;
    createdAt: Date;
    changes: unknown;
    editor: ListingOwnerRow;
}): ListingRevisionDto {
    return {
        id: row.id,
        createdAt: row.createdAt,
        editor: { id: row.editor.id, name: row.editor.name },
        changes: Array.isArray(row.changes)
            ? (row.changes as unknown as ListingChange[])
            : [],
    };
}
