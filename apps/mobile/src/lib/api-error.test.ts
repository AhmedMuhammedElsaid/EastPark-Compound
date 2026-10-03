import { getErrorStatus, isNoResponseError, pickErrorKey } from "@/lib/api-error";

describe("api-error", () => {
  it("treats errors without a response as network/timeouts", () => {
    expect(isNoResponseError({ code: "ECONNABORTED" })).toBe(true);
    expect(isNoResponseError(null)).toBe(true);
    expect(isNoResponseError({ response: { status: 500 } })).toBe(false);
    expect(getErrorStatus({ response: { status: 409 } })).toBe(409);
  });

  it("picks keys by status with network and fallback entries", () => {
    const map = { 409: "a", network: "n" };
    expect(pickErrorKey({ response: { status: 409 } }, map, "f")).toBe("a");
    expect(pickErrorKey({ response: { status: 418 } }, map, "f")).toBe("f");
    expect(pickErrorKey({}, map, "f")).toBe("n");
    expect(pickErrorKey({}, {}, "f")).toBe("f");
  });
});
