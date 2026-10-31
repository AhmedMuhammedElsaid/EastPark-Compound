/**
 * Flat listing rules (pure). Mirrors apps/backend/Documentation/LISTINGS-CONTRACT.md
 * (ListingUpsertDto, listing.constants.ts). Messages are translation keys, rendered with t().
 */
import type { ListingInput, ListingStatus, ListingType, MyListing } from "@/services/api/listings";
import { z } from "zod";

import { getErrorCode, getErrorStatus } from "@/lib/api-error";
import { resolveImageMime } from "@/lib/feedback-attachments";
import { formatNumber } from "@/lib/format-number";

export const LISTING_MAX_PHOTOS = 8;
/** Server cap for `POST /uploads/image` (contract §5). */
export const LISTING_MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const LISTING_PRICE_MAX = 1_000_000_000;
export const LISTING_AREA_MIN = 20;
export const LISTING_AREA_MAX = 1000;
export const LISTING_DESCRIPTION_MAX = 2000;
export const LISTING_BUILDING_MAX = 10;
export const LISTING_REJECT_REASON_MIN = 3;
export const LISTING_REJECT_REASON_MAX = 500;

export const LISTING_FLOORS = ["G", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"] as const;
export const LISTING_FLATS = ["1", "2", "3", "4", "5"] as const;

const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06F0;
const PHONE_SEPARATORS = /[\s()\-]/g;
const EGYPT_MOBILE = /^(?:\+?20|0)1[0125]\d{8}$/;
const FLOOR = /^(?:[G1-9]|1[01])$/;
const FLAT = /^[1-5]$/;
const ARABIC_DECIMAL_SEPARATOR = /٫/g;
const THOUSANDS_SEPARATORS = /[,،٬\s]/g;
const DIGITS_ONLY = /^\d+$/;

/** Folds Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits to Latin. */
export function foldDigits(value: string): string {
  return Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    for (const zero of [ARABIC_INDIC_ZERO, EXTENDED_ARABIC_INDIC_ZERO]) {
      if (code >= zero && code <= zero + 9)
        return String(code - zero);
    }
    return char;
  }).join("");
}

/** What the backend stores: digits folded, spaces/dashes/parentheses removed. */
export function normalizeListingPhone(value: string): string {
  return foldDigits(value).replace(PHONE_SEPARATORS, "");
}

export function isEgyptianMobile(value: string): boolean {
  return EGYPT_MOBILE.test(normalizeListingPhone(value));
}

/** "a1 " → "A1"; Arabic digits folded. Building codes are upper-case (A1…F2). */
export function normalizeBuilding(value: string): string {
  return foldDigits(value).trim().toUpperCase();
}

/** "g" → "G", "٣" → "3", "03" → "3". */
export function normalizeFloor(value: string): string {
  const v = foldDigits(value).trim().toUpperCase();
  return DIGITS_ONLY.test(v) ? String(Number(v)) : v;
}

/** Parses a typed number: Arabic digits, Arabic decimal comma and thousands separators accepted. */
export function parseListingNumber(value: unknown): number {
  if (typeof value === "number")
    return value;
  if (typeof value !== "string")
    return Number.NaN;
  const v = foldDigits(value).replace(ARABIC_DECIMAL_SEPARATOR, ".").replace(THOUSANDS_SEPARATORS, "").trim();
  return v === "" ? Number.NaN : Number(v);
}

function numberField(requiredKey: string) {
  return z.union([z.string(), z.number()]).transform((value, ctx) => {
    const n = parseListingNumber(value);
    if (Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: requiredKey });
      return z.NEVER;
    }
    return n;
  });
}

function intInRange(min: number, max: number, key: string) {
  return numberField(key).pipe(z.number().int(key).min(min, key).max(max, key));
}

/**
 * The listing form. Inputs are the raw strings the user typed; output is the API shape
 * (photos are handled outside the form because they are uploaded first).
 */
export const listingFormSchema = z.object({
  type: z.enum(["SALE", "RENT"]),
  building: z
    .string()
    .transform(normalizeBuilding)
    .pipe(z.string().min(1, "validation.required").max(LISTING_BUILDING_MAX, "listings.error_building")),
  floor: z.string().transform(normalizeFloor).pipe(z.string().regex(FLOOR, "listings.error_floor")),
  flatNumber: z.string().transform(v => foldDigits(v).trim()).pipe(z.string().regex(FLAT, "listings.error_flat")),
  price: numberField("listings.error_price").pipe(
    z
      .number()
      .min(0.01, "listings.error_price")
      .max(LISTING_PRICE_MAX, "listings.error_price_max")
      .refine(value => Math.round(value * 100) / 100 === value, "validation.price_decimals"),
  ),
  areaSqm: intInRange(LISTING_AREA_MIN, LISTING_AREA_MAX, "listings.error_area"),
  bedrooms: intInRange(0, 10, "listings.error_bedrooms"),
  bathrooms: intInRange(1, 10, "listings.error_bathrooms"),
  furnished: z.boolean(),
  description: z.string().trim().max(LISTING_DESCRIPTION_MAX, "listings.error_description"),
  contactPhone: z
    .string()
    .transform(normalizeListingPhone)
    .pipe(z.string().regex(EGYPT_MOBILE, "listings.error_phone")),
});

export type ListingFormInput = z.input<typeof listingFormSchema>;
export type ListingFormOutput = z.output<typeof listingFormSchema>;

export const EMPTY_LISTING_FORM: ListingFormInput = {
  type: "SALE",
  building: "",
  floor: "",
  flatNumber: "",
  price: "",
  areaSqm: "",
  bedrooms: "",
  bathrooms: "",
  furnished: false,
  description: "",
  contactPhone: "",
};

/** Form values for editing an existing listing (numbers back to strings). */
export function listingToForm(listing: MyListing): ListingFormInput {
  return {
    type: listing.type,
    building: listing.building,
    floor: listing.floor,
    flatNumber: listing.flatNumber,
    price: String(listing.price),
    areaSqm: String(listing.areaSqm),
    bedrooms: String(listing.bedrooms),
    bathrooms: String(listing.bathrooms),
    furnished: listing.furnished,
    description: listing.description ?? "",
    contactPhone: listing.contactPhone,
  };
}

/** API body. An empty description is sent as null so an edit can clear it. */
export function buildListingPayload(values: ListingFormOutput, photos: string[]): ListingInput {
  return {
    ...values,
    description: values.description === "" ? null : values.description,
    photos,
  };
}

const EDITABLE: readonly ListingStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export type OwnerActions = { edit: boolean; renew: boolean; close: boolean; withdraw: boolean };

/** What the owner may do in each status (the contract's status machine). */
export function ownerActions(status: ListingStatus): OwnerActions {
  const editable = EDITABLE.includes(status);
  return {
    edit: editable,
    renew: status === "APPROVED",
    close: status === "APPROVED",
    withdraw: editable,
  };
}

/** Closed states are terminal: no edit, no reopen. */
export function isClosedStatus(status: ListingStatus): boolean {
  return !EDITABLE.includes(status);
}

export type AdminActions = { approve: boolean; reject: boolean; takeDown: boolean };

export function adminActions(status: ListingStatus): AdminActions {
  return { approve: status === "PENDING", reject: status === "PENDING", takeDown: status === "APPROVED" };
}

/** Owner-facing copy key for the close action: SALE → "Mark as sold", RENT → "Mark as rented". */
export function closeActionKey(type: ListingType): string {
  return type === "SALE" ? "listings.action_mark_sold" : "listings.action_mark_rented";
}

/** `A1-3-2`, the backend's unit label. */
export function listingUnitLabel(listing: { building: string; floor: string; flatNumber: string }): string {
  return `${listing.building}-${listing.floor}-${listing.flatNumber}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days until `expiresAt` (0 when today or past), or null when not set. */
export function daysLeft(expiresAt: string | null, now: number = Date.now()): number | null {
  if (!expiresAt)
    return null;
  const ms = Date.parse(expiresAt) - now;
  if (Number.isNaN(ms))
    return null;
  return Math.max(0, Math.ceil(ms / DAY_MS));
}

/** Toast copy for a failed listing request. */
export function listingErrorKey(error: unknown): string {
  const status = getErrorStatus(error);
  if (status === undefined)
    return "errors.unreachable";
  if (status === 429)
    return "listings.error_rate_limited";
  switch (getErrorCode(error)) {
    case "listing.error.unitAlreadyListed": return "listings.error_unit_listed";
    case "listing.error.invalidStatus": return "listings.error_invalid_status";
    case "listing.error.noChanges": return "listings.error_no_changes";
    case "listing.error.photosRequired": return "listings.error_photos";
    case "listing.error.notFound": return "listings.error_not_found";
    case "file.error.urlNotStored": return "listings.error_photo_not_stored";
    default: break;
  }
  if (status === 404)
    return "listings.error_not_found";
  if (status === 403)
    return "errors.forbidden";
  return status >= 500 ? "errors.server" : "common.error";
}

// ─── Photos ───────────────────────────────────────────────────────────────────

/**
 * A photo in the listing form. `mime` is null for a photo that is already stored
 * (an edit keeps its URL); a local pick carries its mime type and is uploaded on submit.
 */
export type ListingPhoto = { uri: string; mime: string | null };

export type ListingAssetCheck = { ok: true; mime: string } | { ok: false; errorKey: string };

/** Picker asset check. Keys are the shared upload copy under `feedback.*`. */
export function validateListingAsset(asset: { uri: string; mimeType?: string | null; fileSize?: number | null }): ListingAssetCheck {
  const mime = resolveImageMime(asset);
  if (!mime)
    return { ok: false, errorKey: "feedback.upload_bad_type" };
  if (asset.fileSize != null && asset.fileSize > LISTING_MAX_PHOTO_BYTES)
    return { ok: false, errorKey: "feedback.upload_too_large" };
  return { ok: true, mime };
}

/** Interpolation values for the photo copy, with locale digits. */
export function listingPhotoParams(language: string) {
  return {
    maxPhotos: formatNumber(LISTING_MAX_PHOTOS, language),
    maxSize: formatNumber(LISTING_MAX_PHOTO_BYTES / (1024 * 1024), language),
  };
}

/** Wraps an upload failure so the submit handler can show upload-specific copy. */
export class ListingUploadError extends Error {
  readonly original: unknown;
  constructor(original: unknown) {
    super("listing_upload_failed");
    this.original = original;
  }
}

/**
 * Uploads the local photos one by one and returns every URL in form order
 * (index 0 is the cover). Stored photos keep their URL. Any failure throws
 * `ListingUploadError` and nothing is submitted.
 */
export async function resolvePhotoUrls(
  photos: readonly ListingPhoto[],
  upload: (uri: string, mime: string) => Promise<string>,
): Promise<string[]> {
  const urls: string[] = [];
  for (const photo of photos) {
    if (photo.mime === null) {
      urls.push(photo.uri);
      continue;
    }
    try {
      urls.push(await upload(photo.uri, photo.mime));
    }
    catch (error) {
      throw new ListingUploadError(error);
    }
  }
  return urls;
}

/** Moves the photo at `from` to the front (it becomes the cover). */
export function makeCover<T>(photos: readonly T[], from: number): T[] {
  if (from <= 0 || from >= photos.length)
    return [...photos];
  const next = [...photos];
  const [picked] = next.splice(from, 1);
  return [picked, ...next];
}

/** Per-status pill colour key, shared by owner and admin views. */
export function statusTone(status: ListingStatus): "success" | "warning" | "error" | "muted" {
  switch (status) {
    case "APPROVED": return "success";
    case "PENDING": return "warning";
    case "REJECTED": return "error";
    default: return "muted";
  }
}

// ─── Revision history (admin) ─────────────────────────────────────────────────

const REVISION_FIELD_KEYS: Record<string, string> = {
  type: "listings.field_type",
  building: "listings.field_building",
  floor: "listings.field_floor",
  flatNumber: "listings.field_flat",
  areaSqm: "listings.field_area",
  bedrooms: "listings.field_bedrooms",
  bathrooms: "listings.field_bathrooms",
  furnished: "listings.field_furnished",
  description: "listings.description",
  contactPhone: "listings.field_phone",
  photos: "listings.photos",
};

/** Label key for a changed field; price follows the listing's current type. */
export function revisionFieldKey(field: string, type: ListingType): string {
  if (field === "price")
    return type === "RENT" ? "listings.field_price_rent" : "listings.field_price_sale";
  return REVISION_FIELD_KEYS[field] ?? field;
}

export type RevisionValue
  = | { kind: "empty" }
    | { kind: "key"; key: string }
    | { kind: "money"; amount: number }
    | { kind: "text"; text: string };

const REVISION_TEXT_MAX = 80;

/** How one side of a field change is shown: translated enum, money, or plain (clipped) text. */
export function revisionValue(field: string, value: unknown): RevisionValue {
  if (value === null || value === undefined || value === "")
    return { kind: "empty" };
  if (field === "type" && (value === "SALE" || value === "RENT"))
    return { kind: "key", key: `listings.type_${value}` };
  if (field === "furnished" && typeof value === "boolean")
    return { kind: "key", key: value ? "listings.yes" : "listings.no" };
  if (field === "price" && typeof value === "number")
    return { kind: "money", amount: value };
  const text = String(value);
  return { kind: "text", text: text.length > REVISION_TEXT_MAX ? `${text.slice(0, REVISION_TEXT_MAX - 1)}…` : text };
}
