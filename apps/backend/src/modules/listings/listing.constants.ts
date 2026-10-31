import { ListingStatus } from '@prisma/client';

/** Field limits shared by the DTO validators and the service. */
export const LISTING_LIMITS = {
    buildingMax: 10,
    descriptionMax: 2000,
    priceMax: 1_000_000_000,
    areaMin: 20,
    areaMax: 1000,
    photosMin: 1,
    photosMax: 8,
} as const;

/** A listing stays visible this long after approval or renewal. */
export const LISTING_VALIDITY_DAYS = 60;
export const LISTING_VALIDITY_MS = LISTING_VALIDITY_DAYS * 24 * 60 * 60 * 1000;

/** Active = holds the flat (partial unique index `listings_active_unit_key`). */
export const ACTIVE_LISTING_STATUSES: ListingStatus[] = [
    ListingStatus.PENDING,
    ListingStatus.APPROVED,
];

/** The owner may edit or withdraw from any of these. Closed states are terminal. */
export const OWNER_EDITABLE_STATUSES: ListingStatus[] = [
    ListingStatus.PENDING,
    ListingStatus.APPROVED,
    ListingStatus.REJECTED,
];

/** Create is capped per user: 5 per hour. */
export const LISTING_CREATE_LIMIT = 5;
export const LISTING_CREATE_WINDOW_SECONDS = 60 * 60;

/** Fields compared by the revision diff (everything the owner can edit). */
export const LISTING_EDITABLE_FIELDS = [
    'type',
    'building',
    'floor',
    'flatNumber',
    'price',
    'areaSqm',
    'bedrooms',
    'bathrooms',
    'furnished',
    'description',
    'contactPhone',
    'photos',
] as const;

export type ListingEditableField = (typeof LISTING_EDITABLE_FIELDS)[number];
