import { ListingType, Prisma } from '@prisma/client';

import { toMoneyNumber } from 'src/common/helper/money';

import {
    LISTING_EDITABLE_FIELDS,
    ListingEditableField,
} from './listing.constants';

/** Editable values in their API shape (price as number, description null when empty). */
export interface ListingFields {
    type: ListingType;
    building: string;
    floor: string;
    flatNumber: string;
    price: number;
    areaSqm: number;
    bedrooms: number;
    bathrooms: number;
    furnished: boolean;
    description: string | null;
    contactPhone: string;
    photos: string[];
}

/** One `ListingRevisionDto.changes` entry. */
export type ListingChange =
    | { field: Exclude<ListingEditableField, 'photos'>; from: unknown; to: unknown }
    | { field: 'photos'; added: string[]; removed: string[]; reordered?: true };

/** A stored row (or the subset the diff needs) → API-shape fields. */
export function toFields(row: {
    type: ListingType;
    building: string;
    floor: string;
    flatNumber: string;
    price: Prisma.Decimal | number | string;
    areaSqm: number;
    bedrooms: number;
    bathrooms: number;
    furnished: boolean;
    description: string | null;
    contactPhone: string;
    photos: string[];
}): ListingFields {
    return {
        type: row.type,
        building: row.building,
        floor: row.floor,
        flatNumber: row.flatNumber,
        price: toMoneyNumber(row.price),
        areaSqm: row.areaSqm,
        bedrooms: row.bedrooms,
        bathrooms: row.bathrooms,
        furnished: row.furnished,
        description: row.description,
        contactPhone: row.contactPhone,
        photos: [...row.photos],
    };
}

/** Request body → normalised fields (`""` description becomes null, price rounded to cents). */
export function normalizeFields(dto: {
    type: ListingType;
    building: string;
    floor: string;
    flatNumber: string;
    price: number;
    areaSqm: number;
    bedrooms: number;
    bathrooms: number;
    furnished: boolean;
    description?: string | null;
    contactPhone: string;
    photos: string[];
}): ListingFields {
    const description = dto.description?.trim();
    return {
        type: dto.type,
        building: dto.building.trim(),
        floor: dto.floor,
        flatNumber: dto.flatNumber,
        price: toMoneyNumber(dto.price),
        areaSqm: dto.areaSqm,
        bedrooms: dto.bedrooms,
        bathrooms: dto.bathrooms,
        furnished: dto.furnished,
        description: description ? description : null,
        contactPhone: dto.contactPhone,
        photos: [...dto.photos],
    };
}

function photoChange(
    previous: string[],
    next: string[]
): Extract<ListingChange, { field: 'photos' }> | null {
    const prevSet = new Set(previous);
    const nextSet = new Set(next);
    const added = next.filter(url => !prevSet.has(url));
    const removed = previous.filter(url => !nextSet.has(url));

    // Order of the photos that survived the edit, on each side.
    const keptBefore = previous.filter(url => nextSet.has(url));
    const keptAfter = next.filter(url => prevSet.has(url));
    const reordered = keptBefore.some((url, index) => url !== keptAfter[index]);

    if (added.length === 0 && removed.length === 0 && !reordered) return null;
    return reordered
        ? { field: 'photos', added, removed, reordered: true }
        : { field: 'photos', added, removed };
}

/**
 * Only the fields whose value actually changed, in a stable field order. An
 * empty result means a no-op edit (the service answers 400 `noChanges`).
 */
export function diffListing(
    previous: ListingFields,
    next: ListingFields
): ListingChange[] {
    const changes: ListingChange[] = [];
    for (const field of LISTING_EDITABLE_FIELDS) {
        if (field === 'photos') {
            const change = photoChange(previous.photos, next.photos);
            if (change) changes.push(change);
            continue;
        }
        if (previous[field] !== next[field]) {
            changes.push({ field, from: previous[field], to: next[field] });
        }
    }
    return changes;
}
