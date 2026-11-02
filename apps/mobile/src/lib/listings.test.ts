import {
  adminActions,
  buildListingPayload,
  closeActionKey,
  daysLeft,
  EMPTY_LISTING_FORM,
  foldDigits,
  isClosedStatus,
  isEgyptianMobile,
  listingErrorKey,
  listingFormSchema,
  listingPhotoParams,
  listingToForm,
  listingUnitLabel,
  ListingUploadError,
  makeCover,
  normalizeFloor,
  ownerActions,
  parseListingNumber,
  resolvePhotoUrls,
  revisionFieldKey,
  revisionValue,
  statusTone,
  validateListingAsset,
} from "./listings";

const valid = {
  ...EMPTY_LISTING_FORM,
  building: " a1 ",
  floor: "3",
  flatNumber: "2",
  price: "2,500,000",
  areaSqm: "140",
  bedrooms: "3",
  bathrooms: "2",
  contactPhone: "010 1234 5678",
};

const httpError = (status: number, code?: string) => ({ response: { status, data: code ? { code } : {} } });

function firstMessage(input: unknown): string | undefined {
  const result = listingFormSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("listing form schema", () => {
  it("normalises a valid form to the API shape", () => {
    const result = listingFormSchema.parse(valid);
    expect(result).toEqual({
      type: "SALE",
      building: "A1",
      floor: "3",
      flatNumber: "2",
      price: 2_500_000,
      areaSqm: 140,
      bedrooms: 3,
      bathrooms: 2,
      furnished: false,
      description: "",
      contactPhone: "01012345678",
    });
  });

  it("accepts Arabic digits everywhere", () => {
    const result = listingFormSchema.parse({
      ...valid,
      floor: "١١",
      flatNumber: "٥",
      price: "١٢٠٠٠٫٥",
      areaSqm: "٩٠",
      contactPhone: "٠١٠١٢٣٤٥٦٧٨",
    });
    expect(result).toMatchObject({ floor: "11", flatNumber: "5", price: 12000.5, areaSqm: 90, contactPhone: "01012345678" });
  });

  it("accepts ground floor in any case", () => {
    expect(listingFormSchema.parse({ ...valid, floor: "g" }).floor).toBe("G");
  });

  it.each([
    [{ floor: "12" }, "listings.error_floor"],
    [{ floor: "0" }, "listings.error_floor"],
    [{ flatNumber: "6" }, "listings.error_flat"],
    [{ building: "   " }, "validation.required"],
    [{ building: "ABCDEFGHIJK" }, "listings.error_building"],
    [{ price: "" }, "listings.error_price"],
    [{ price: "0" }, "listings.error_price"],
    [{ price: "1000000001" }, "listings.error_price_max"],
    [{ price: "10.555" }, "validation.price_decimals"],
    [{ areaSqm: "19" }, "listings.error_area"],
    [{ areaSqm: "90.5" }, "listings.error_area"],
    [{ bedrooms: "11" }, "listings.error_bedrooms"],
    [{ bathrooms: "0" }, "listings.error_bathrooms"],
    [{ contactPhone: "0201234567" }, "listings.error_phone"],
    [{ contactPhone: "01312345678" }, "listings.error_phone"],
    [{ description: "x".repeat(2001) }, "listings.error_description"],
  ])("rejects %o with %s", (override, key) => {
    expect(firstMessage({ ...valid, ...override })).toBe(key);
  });

  it("accepts studio flats and international phone formats", () => {
    expect(firstMessage({ ...valid, bedrooms: "0" })).toBeUndefined();
    expect(firstMessage({ ...valid, contactPhone: "+20 101 234 5678" })).toBeUndefined();
    expect(isEgyptianMobile("201512345678")).toBe(true);
  });
});

describe("payload and form round trip", () => {
  it("sends an empty description as null and keeps photo order", () => {
    const values = listingFormSchema.parse(valid);
    expect(buildListingPayload(values, ["b", "a"])).toMatchObject({ description: null, photos: ["b", "a"] });
    expect(buildListingPayload({ ...values, description: "Sea view" }, []).description).toBe("Sea view");
  });

  it("turns a listing back into form strings", () => {
    const form = listingToForm({
      id: "l1",
      type: "RENT",
      status: "APPROVED",
      building: "B2",
      floor: "G",
      flatNumber: "1",
      unitLabel: "B2-G-1",
      price: 15000,
      areaSqm: 120,
      bedrooms: 2,
      bathrooms: 1,
      furnished: true,
      description: null,
      contactPhone: "01112345678",
      photos: [],
      approvedAt: null,
      expiresAt: null,
      createdAt: "",
      updatedAt: "",
      owner: { id: "u", name: "A" },
      rejectReason: null,
    });
    expect(form).toMatchObject({ price: "15000", areaSqm: "120", description: "", furnished: true });
    expect(listingFormSchema.parse(form).price).toBe(15000);
  });
});

describe("status rules", () => {
  it("follows the contract's owner state machine", () => {
    expect(ownerActions("PENDING")).toEqual({ edit: true, renew: false, close: false, withdraw: true });
    expect(ownerActions("APPROVED")).toEqual({ edit: true, renew: true, close: true, withdraw: true });
    expect(ownerActions("REJECTED")).toEqual({ edit: true, renew: false, close: false, withdraw: true });
    for (const status of ["SOLD", "RENTED", "WITHDRAWN", "EXPIRED"] as const) {
      expect(ownerActions(status)).toEqual({ edit: false, renew: false, close: false, withdraw: false });
      expect(isClosedStatus(status)).toBe(true);
    }
  });

  it("offers admin actions by status", () => {
    expect(adminActions("PENDING")).toEqual({ approve: true, reject: true, takeDown: false });
    expect(adminActions("APPROVED")).toEqual({ approve: false, reject: false, takeDown: true });
    expect(adminActions("REJECTED")).toEqual({ approve: false, reject: false, takeDown: false });
  });

  it("labels the close action by type", () => {
    expect(closeActionKey("SALE")).toBe("listings.action_mark_sold");
    expect(closeActionKey("RENT")).toBe("listings.action_mark_rented");
  });
});

describe("helpers", () => {
  it("folds both Arabic digit sets", () => {
    expect(foldDigits("٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789 0123456789");
  });

  it("normalises floors", () => {
    expect(normalizeFloor("03")).toBe("3");
    expect(normalizeFloor(" g ")).toBe("G");
  });

  it("parses typed numbers", () => {
    expect(parseListingNumber("1,250,000")).toBe(1_250_000);
    expect(parseListingNumber("١٬٢٥٠")).toBe(1250);
    expect(parseListingNumber("")).toBeNaN();
    expect(parseListingNumber("abc")).toBeNaN();
  });

  it("builds the unit label", () => {
    expect(listingUnitLabel({ building: "A1", floor: "G", flatNumber: "4" })).toBe("A1-G-4");
  });

  it("counts whole days left", () => {
    const now = Date.parse("2026-10-31T12:00:00Z");
    expect(daysLeft("2026-11-02T11:00:00Z", now)).toBe(2);
    expect(daysLeft("2026-10-30T00:00:00Z", now)).toBe(0);
    expect(daysLeft(null, now)).toBeNull();
  });
});

describe("listingErrorKey", () => {
  it.each([
    [httpError(409, "listing.error.unitAlreadyListed"), "listings.error_unit_listed"],
    [httpError(409, "listing.error.invalidStatus"), "listings.error_invalid_status"],
    [httpError(409, "listing.error.ownerDeleted"), "listings.error_owner_deleted"],
    [httpError(400, "listing.error.noChanges"), "listings.error_no_changes"],
    [httpError(400, "listing.error.photosRequired"), "listings.error_photos"],
    [httpError(400, "file.error.urlNotStored"), "listings.error_photo_not_stored"],
    [httpError(404), "listings.error_not_found"],
    [httpError(429), "listings.error_rate_limited"],
    [httpError(403), "errors.forbidden"],
    [httpError(503), "errors.server"],
    [httpError(400), "common.error"],
    [new Error("offline"), "errors.unreachable"],
  ])("maps %o to %s", (error, key) => {
    expect(listingErrorKey(error)).toBe(key);
  });
});

describe("listing photos", () => {
  it("checks type and the 5 MB cap", () => {
    expect(validateListingAsset({ uri: "a.jpg", mimeType: "image/jpeg", fileSize: 5 * 1024 * 1024 })).toEqual({ ok: true, mime: "image/jpeg" });
    expect(validateListingAsset({ uri: "a.jpg", mimeType: "image/jpeg", fileSize: 5 * 1024 * 1024 + 1 })).toEqual({ ok: false, errorKey: "feedback.upload_too_large" });
    expect(validateListingAsset({ uri: "a.heic", mimeType: "image/heic" })).toEqual({ ok: false, errorKey: "feedback.upload_bad_type" });
    expect(validateListingAsset({ uri: "a.png" })).toEqual({ ok: true, mime: "image/png" });
  });

  it("uploads local photos in order and keeps stored URLs", async () => {
    const upload = jest.fn(async (uri: string) => `https://cdn/${uri}`);
    const urls = await resolvePhotoUrls(
      [{ uri: "https://cdn/old", mime: null }, { uri: "new1", mime: "image/jpeg" }, { uri: "new2", mime: "image/png" }],
      upload,
    );
    expect(urls).toEqual(["https://cdn/old", "https://cdn/new1", "https://cdn/new2"]);
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it("wraps an upload failure", async () => {
    const boom = new Error("502");
    await expect(resolvePhotoUrls([{ uri: "x", mime: "image/jpeg" }], async () => {
      throw boom;
    })).rejects.toBeInstanceOf(ListingUploadError);
  });

  it("moves a photo to the cover slot", () => {
    expect(makeCover(["a", "b", "c"], 2)).toEqual(["c", "a", "b"]);
    expect(makeCover(["a", "b"], 0)).toEqual(["a", "b"]);
    expect(makeCover(["a"], 5)).toEqual(["a"]);
  });

  it("formats the limits with locale digits", () => {
    expect(listingPhotoParams("en")).toEqual({ maxPhotos: "8", maxSize: "5" });
    expect(listingPhotoParams("ar")).toEqual({ maxPhotos: "٨", maxSize: "٥" });
  });

  it("maps statuses to tones", () => {
    expect(statusTone("APPROVED")).toBe("success");
    expect(statusTone("PENDING")).toBe("warning");
    expect(statusTone("REJECTED")).toBe("error");
    expect(statusTone("SOLD")).toBe("muted");
  });
});

describe("revision history", () => {
  it("labels fields, price by the listing type", () => {
    expect(revisionFieldKey("flatNumber", "SALE")).toBe("listings.field_flat");
    expect(revisionFieldKey("price", "SALE")).toBe("listings.field_price_sale");
    expect(revisionFieldKey("price", "RENT")).toBe("listings.field_price_rent");
    expect(revisionFieldKey("somethingNew", "SALE")).toBe("somethingNew");
  });

  it("formats each side of a change", () => {
    expect(revisionValue("description", null)).toEqual({ kind: "empty" });
    expect(revisionValue("description", "")).toEqual({ kind: "empty" });
    expect(revisionValue("type", "RENT")).toEqual({ kind: "key", key: "listings.type_RENT" });
    expect(revisionValue("furnished", false)).toEqual({ kind: "key", key: "listings.no" });
    expect(revisionValue("price", 15000)).toEqual({ kind: "money", amount: 15000 });
    expect(revisionValue("bedrooms", 3)).toEqual({ kind: "text", text: "3" });
    const long = revisionValue("description", "x".repeat(200));
    expect(long.kind === "text" && long.text.length).toBe(80);
  });
});
