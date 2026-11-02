import {
  amountToString,
  cairoToday,
  financeErrorKey,
  isCollectedPayment,
  isDuplicateReferenceError,
  isUnconfirmedPaymentError,
  newIdempotencyKey,
  normalizeFlatQuery,
  shiftDate,
  toAmountString,
} from "./finance";

const httpError = (status: number, message?: string) => ({ response: { status, data: { message } } });

describe("toAmountString", () => {
  it.each([
    ["450", "450.00"],
    ["450.5", "450.50"],
    ["1,250.75", "1250.75"],
    ["١٢٥٠٫٥", "1250.50"],
    [" 0.01 ", "0.01"],
    ["9999999.99", "9999999.99"],
    ["007", "7.00"],
  ])("%s -> %s", (input, expected) => {
    expect(toAmountString(input)).toBe(expected);
  });

  it.each(["", "0", "0.00", "-5", "1.234", "abc", "10000000", "1e3"])("rejects %s", (input) => {
    expect(toAmountString(input)).toBeNull();
  });

  it("amountToString keeps 2 decimals", () => {
    expect(amountToString(550)).toBe("550.00");
    expect(amountToString(0.1 + 0.2)).toBe("0.30");
  });
});

describe("financeErrorKey", () => {
  it("maps backend finance codes to finance.errors copy", () => {
    expect(financeErrorKey(httpError(409, "finance.error.periodClosed"))).toBe("finance.errors.periodClosed");
    expect(financeErrorKey(httpError(409, "finance.error.creditChanged"))).toBe("finance.errors.creditChanged");
  });

  it("falls back on the status", () => {
    expect(financeErrorKey(new Error("offline"))).toBe("errors.unreachable");
    expect(financeErrorKey(httpError(400, "Some prose"))).toBe("finance.errors.check_form");
    expect(financeErrorKey(httpError(429))).toBe("errors.rate_limited");
    expect(financeErrorKey(httpError(500))).toBe("errors.server");
  });

  it("recognises the duplicate-reference warning", () => {
    expect(isDuplicateReferenceError(httpError(409, "finance.error.duplicateReference"))).toBe(true);
    expect(isDuplicateReferenceError(httpError(409, "finance.error.periodClosed"))).toBe(false);
  });

  it("treats no response, 408, 429 and 5xx on payment create as unconfirmed", () => {
    expect(isUnconfirmedPaymentError(new Error("offline"))).toBe(true);
    for (const status of [408, 429, 500, 502, 503, 504])
      expect(isUnconfirmedPaymentError(httpError(status))).toBe(true);
    for (const status of [400, 403, 404, 409, 422])
      expect(isUnconfirmedPaymentError(httpError(status))).toBe(false);
  });
});

describe("isCollectedPayment", () => {
  it("leaves uncleared and bounced cheques out of today's collection", () => {
    expect(isCollectedPayment({ status: "POSTED", chequeState: "NOT_APPLICABLE" })).toBe(true);
    expect(isCollectedPayment({ status: "POSTED", chequeState: "CLEARED" })).toBe(true);
    expect(isCollectedPayment({ status: "POSTED", chequeState: "PENDING_CLEARANCE" })).toBe(false);
    expect(isCollectedPayment({ status: "POSTED", chequeState: "BOUNCED" })).toBe(false);
    expect(isCollectedPayment({ status: "VOID", chequeState: "NOT_APPLICABLE" })).toBe(false);
  });
});

describe("idempotency keys and dates", () => {
  it("creates distinct keys matching the server pattern", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).toMatch(/^[\w-]{8,100}$/);
    expect(a).not.toBe(b);
  });

  it("cairoToday is a YYYY-MM-DD date", () => {
    expect(cairoToday(new Date("2026-11-01T22:30:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("shiftDate crosses month boundaries", () => {
    expect(shiftDate("2026-11-01", -1)).toBe("2026-10-31");
  });

  it("normalizeFlatQuery folds digits and upper-cases", () => {
    expect(normalizeFlatQuery(" a١-٣ ")).toBe("A1-3");
  });
});
