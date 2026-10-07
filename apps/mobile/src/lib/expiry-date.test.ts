import {
  combineDateAndTime,
  expirySchema,
  formatExpiry,
  initialPickerValue,
  isFutureExpiry,
  toExpiryIso,
} from "@/lib/expiry-date";
import { buildElectionPayload, buildPollPayload } from "@/lib/governance-payload";

const NOW = new Date(2026, 9, 7, 14, 30, 0, 0).getTime();

describe("expiry date", () => {
  it("takes the day from the date pick and the hour/minute from the time pick", () => {
    const day = new Date(2026, 9, 20, 3, 59, 59, 999);
    const time = new Date(2001, 0, 1, 18, 45, 12, 500);
    const combined = combineDateAndTime(day, time);
    expect(combined.getFullYear()).toBe(2026);
    expect(combined.getMonth()).toBe(9);
    expect(combined.getDate()).toBe(20);
    expect(combined.getHours()).toBe(18);
    expect(combined.getMinutes()).toBe(45);
    expect(combined.getSeconds()).toBe(0);
    expect(combined.getMilliseconds()).toBe(0);
  });

  it("serialises to an ISO instant that round-trips to the picked local time", () => {
    const picked = new Date(2026, 9, 20, 18, 45);
    const iso = toExpiryIso(picked);
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(iso).getTime()).toBe(picked.getTime());
  });

  it("only accepts instants after now", () => {
    expect(isFutureExpiry(new Date(NOW + 60_000), NOW)).toBe(true);
    expect(isFutureExpiry(new Date(NOW), NOW)).toBe(false);
    expect(isFutureExpiry(new Date(NOW - 60_000), NOW)).toBe(false);
    expect(isFutureExpiry(new Date(Number.NaN), NOW)).toBe(false);
  });

  it("opens the picker on the current value, else tomorrow at the next whole hour", () => {
    const current = new Date(2026, 11, 1, 9, 0);
    expect(initialPickerValue(current, NOW)).toBe(current);
    const fallback = initialPickerValue(undefined, NOW);
    expect(fallback.getTime()).toBeGreaterThan(NOW + 24 * 60 * 60 * 1000);
    expect(fallback.getMinutes()).toBe(0);
    expect(fallback.getSeconds()).toBe(0);
  });

  it("schema rejects a missing, invalid or past value and accepts a future one", () => {
    expect(expirySchema.safeParse(undefined).success).toBe(false);
    expect(expirySchema.safeParse(new Date(Number.NaN)).success).toBe(false);
    const past = expirySchema.safeParse(new Date(Date.now() - 60_000));
    expect(past.success).toBe(false);
    expect(past.error?.issues[0]?.message).toBe("validation.expiry_future");
    expect(expirySchema.safeParse(new Date(Date.now() + 3_600_000)).success).toBe(true);
  });

  it("formats with locale digits", () => {
    const d = new Date(2026, 9, 20, 18, 45);
    expect(formatExpiry(d, "en")).toMatch(/2026/);
    expect(formatExpiry(d, "ar")).not.toMatch(/2026/);
  });
});

describe("governance payloads", () => {
  const expiresAt = new Date(2026, 9, 20, 18, 45);

  it("poll payload trims text and sends expiry as ISO", () => {
    const payload = buildPollPayload({
      question: "  Parking? ",
      questionAr: " الوقوف؟ ",
      options: [{ label: " Yes ", labelAr: " نعم " }, { label: "No", labelAr: "لا" }],
      expiresAt,
    });
    expect(payload.question).toBe("Parking?");
    expect(payload.questionAr).toBe("الوقوف؟");
    expect(payload.options[0]).toEqual({ label: "Yes", labelAr: "نعم" });
    expect(new Date(payload.expiresAt).getTime()).toBe(expiresAt.getTime());
  });

  it("election payload drops blank descriptions and keeps filled ones", () => {
    const blank = buildElectionPayload({ title: "Board", titleAr: "المجلس", description: "  ", descriptionAr: "", expiresAt, visibilityMode: "ADMIN_CONTROLLED" });
    expect(blank).not.toHaveProperty("description");
    expect(blank).not.toHaveProperty("descriptionAr");
    expect(blank.visibilityMode).toBe("ADMIN_CONTROLLED");
    expect(new Date(blank.expiresAt).getTime()).toBe(expiresAt.getTime());

    const filled = buildElectionPayload({ title: "Board", titleAr: "المجلس", description: " Vote ", descriptionAr: "صوّت", expiresAt, visibilityMode: "LIVE_COUNT" });
    expect(filled.description).toBe("Vote");
    expect(filled.descriptionAr).toBe("صوّت");
  });
});
