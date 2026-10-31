import { client } from "./client";

/**
 * Flat listings (sell / rent). Typed to apps/backend/Documentation/LISTINGS-CONTRACT.md —
 * keep the two in step.
 */
export type ListingType = "SALE" | "RENT";
export type ListingStatus
  = | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "SOLD"
    | "RENTED"
    | "WITHDRAWN"
    | "EXPIRED";

export const LISTING_STATUSES: readonly ListingStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SOLD",
  "RENTED",
  "WITHDRAWN",
  "EXPIRED",
];

/** What a browsing resident sees (`GET /listings`, `GET /listings/:id`). */
export type Listing = {
  id: string;
  type: ListingType;
  status: ListingStatus;
  building: string;
  floor: string;
  flatNumber: string;
  unitLabel: string;
  price: number;
  areaSqm: number;
  bedrooms: number;
  bathrooms: number;
  furnished: boolean;
  description: string | null;
  contactPhone: string;
  /** Index 0 is the cover. */
  photos: string[];
  approvedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string };
};

/** The owner's own listing (`GET /listings/mine`, owner view of `GET /listings/:id`). */
export type MyListing = Listing & { rejectReason: string | null };

/** Admin review row (`GET /admin/listings`). */
export type AdminListing = Omit<MyListing, "owner"> & {
  owner: { id: string; name: string; email: string; phone: string | null };
  revisionCount: number;
};

export type ListingFieldChange
  = | { field: string; from: unknown; to: unknown }
    | { field: "photos"; added: string[]; removed: string[]; reordered?: boolean };

export type ListingRevision = {
  id: string;
  createdAt: string;
  editor: { id: string; name: string };
  changes: ListingFieldChange[];
};

export type ListingStats = Record<ListingStatus, number> & { total: number };

/** Create body; `PATCH /listings/:id` takes the same full body (replacement, not partial). */
export type ListingInput = {
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
};

export type Page<T> = { items: T[]; nextCursor: string | null };
type Envelope<T> = { data: T };

const id$ = (id: string) => encodeURIComponent(id);

export const listingsApi = {
  browse: (params: { type?: ListingType; cursor?: string; limit?: number }) =>
    client.get<Envelope<Page<Listing>>>("/listings", { params }),

  /** Visible approved listing, or the caller's own listing in any status. */
  getById: (id: string) => client.get<Envelope<Listing | MyListing>>(`/listings/${id$(id)}`),

  mine: (params: { status?: ListingStatus; cursor?: string; limit?: number }) =>
    client.get<Envelope<Page<MyListing>>>("/listings/mine", { params }),

  create: (body: ListingInput) => client.post<Envelope<MyListing>>("/listings", body),

  update: (id: string, body: ListingInput) =>
    client.patch<Envelope<MyListing>>(`/listings/${id$(id)}`, body),

  renew: (id: string) => client.post<Envelope<MyListing>>(`/listings/${id$(id)}/renew`),

  close: (id: string) => client.post<Envelope<MyListing>>(`/listings/${id$(id)}/close`),

  withdraw: (id: string) => client.post<Envelope<MyListing>>(`/listings/${id$(id)}/withdraw`),
};

export const adminListingsApi = {
  list: (params: {
    status?: ListingStatus;
    type?: ListingType;
    q?: string;
    cursor?: string;
    limit?: number;
  }) => client.get<Envelope<Page<AdminListing>>>("/admin/listings", { params }),

  stats: () => client.get<Envelope<ListingStats>>("/admin/listings/stats"),

  getById: (id: string) => client.get<Envelope<AdminListing>>(`/admin/listings/${id$(id)}`),

  revisions: (id: string, params?: { cursor?: string; limit?: number }) =>
    client.get<Envelope<Page<ListingRevision>>>(`/admin/listings/${id$(id)}/revisions`, { params }),

  approve: (id: string) => client.post<Envelope<AdminListing>>(`/admin/listings/${id$(id)}/approve`),

  /** PENDING → REJECTED, or APPROVED → REJECTED (take down). Reason 3–500 chars. */
  reject: (id: string, reason: string) =>
    client.post<Envelope<AdminListing>>(`/admin/listings/${id$(id)}/reject`, { reason }),
};

/** Query keys, shared so mutations invalidate every view of a listing. */
export const listingKeys = {
  all: ["listings"] as const,
  browse: (type?: ListingType) => ["listings", "browse", type ?? "ALL"] as const,
  detail: (id: string) => ["listings", "detail", id] as const,
  mine: () => ["listings", "mine"] as const,
  admin: (status?: ListingStatus, q?: string) => ["listings", "admin", status ?? "ALL", q ?? ""] as const,
  adminStats: () => ["listings", "admin", "stats"] as const,
  adminDetail: (id: string) => ["listings", "admin", "detail", id] as const,
  revisions: (id: string) => ["listings", "admin", "revisions", id] as const,
};
