import { isValidPhone, normalizePhone } from "@/lib/phone";

describe("phone", () => {
  it("normalises Egyptian local numbers to +20", () => {
    expect(normalizePhone("01012345678")).toBe("+201012345678");
    expect(normalizePhone(" 010 1234-5678 ")).toBe("+201012345678");
  });

  it("converts 00 prefixes and keeps international numbers", () => {
    expect(normalizePhone("0020 10 1234 5678")).toBe("+201012345678");
    expect(normalizePhone("+20 10 1234 5678")).toBe("+201012345678");
  });

  it("accepts empty and international values", () => {
    expect(isValidPhone("")).toBe(true);
    expect(isValidPhone(undefined)).toBe(true);
    expect(isValidPhone("01012345678")).toBe(true);
    expect(isValidPhone("+201012345678")).toBe(true);
  });

  it("rejects values the backend would reject", () => {
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("abc")).toBe(false);
    expect(isValidPhone("0212345678")).toBe(false);
  });
});
