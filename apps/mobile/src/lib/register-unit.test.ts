import { FLAT_OPTIONS, getFloorOptions, isValidFloorForBuilding } from "@/lib/compound";
import { registerUnitSchema, toLeadPayload } from "@/lib/register-unit";

const valid = {
  name: "Ahmed Hassan",
  email: "Ahmed@Example.com",
  phone: "0100 040-0163",
  building: "A2",
  floor: "G",
  flatNumber: "3",
};

describe("compound layout", () => {
  it("offers the ground floor only in phases 2 and 3", () => {
    expect(getFloorOptions("A1").map(o => o.value)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]);
    expect(getFloorOptions("A2")[0].value).toBe("G");
    expect(getFloorOptions("D1")[0].value).toBe("G");
    expect(getFloorOptions("C3")[0].value).toBe("1");
    expect(getFloorOptions("nope")).toEqual([]);
  });

  it("rejects an impossible unit and keeps 5 flats per floor", () => {
    expect(isValidFloorForBuilding("G", "A1")).toBe(false);
    expect(isValidFloorForBuilding("G", "A2")).toBe(true);
    expect(FLAT_OPTIONS.map(o => o.value)).toEqual(["1", "2", "3", "4", "5"]);
  });
});

describe("registerUnitSchema", () => {
  it("accepts a complete registration", () => {
    expect(registerUnitSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a ground floor in a phase 1 building on the floor field", () => {
    const r = registerUnitSchema.safeParse({ ...valid, building: "A1", floor: "G" });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].path).toEqual(["floor"]);
  });

  it("rejects a bad phone, e-mail and national id with i18n keys", () => {
    const r = registerUnitSchema.safeParse({ ...valid, phone: "123", email: "x", nationalId: "12" });
    const messages = !r.success ? r.error.issues.map(i => i.message) : [];
    expect(messages).toEqual(expect.arrayContaining([
      "register.errors.invalid_phone",
      "register.errors.invalid_email",
      "register.errors.invalid_national_id",
    ]));
  });
});

describe("toLeadPayload", () => {
  it("lower-cases the e-mail and omits blank optional fields", () => {
    const parsed = registerUnitSchema.parse({ ...valid, parking: " ", jobTitle: "", maritalStatus: "", nationalId: "", passportNumber: "" });
    expect(toLeadPayload(parsed)).toEqual({
      name: "Ahmed Hassan",
      email: "ahmed@example.com",
      phone: "0100 040-0163",
      building: "A2",
      floor: "G",
      flatNumber: "3",
    });
  });

  it("keeps filled optional fields", () => {
    const parsed = registerUnitSchema.parse({ ...valid, parking: "B-12", maritalStatus: "SINGLE", nationalId: "29801011234567" });
    expect(toLeadPayload(parsed)).toMatchObject({ parking: "B-12", maritalStatus: "SINGLE", nationalId: "29801011234567" });
  });
});

describe("arabic-Indic digits", () => {
  const ar = { name: "أحمد حسن", email: "a@b.co", phone: "٠١٠٠٠٤٠٠١٦٣", building: "A2", floor: "3", flatNumber: "2", nationalId: "٢٩٨٠١٠١١٢٣٤٥٦٧" };

  it("accepts them and sends Latin digits", () => {
    const r = registerUnitSchema.safeParse(ar);
    expect(r.success).toBe(true);
    expect(toLeadPayload(registerUnitSchema.parse(ar))).toMatchObject({ phone: "01000400163", nationalId: "29801011234567" });
  });
});
