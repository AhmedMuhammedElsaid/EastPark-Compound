import { profileFormDefaults, profileFormSchema, profileSaveErrorKey, toProfileUpdate } from "./profile-form";

function issues(values: { name: string; phone: string }) {
  const result = profileFormSchema.safeParse(values);
  return result.success ? {} : Object.fromEntries(result.error.issues.map(i => [i.path.join("."), i.message]));
}

describe("profile form schema", () => {
  it("accepts a trimmed name and an empty phone", () => {
    expect(issues({ name: "  Ahmed  ", phone: "" })).toEqual({});
  });

  it("requires 2 to 100 characters after trimming", () => {
    expect(issues({ name: " A ", phone: "" })).toEqual({ name: "validation.min_2" });
    expect(issues({ name: "x".repeat(101), phone: "" })).toEqual({ name: "validation.max_100" });
  });

  it("accepts international and Egyptian local phones, rejects the rest", () => {
    expect(issues({ name: "Ahmed", phone: "+20 10 1234 5678" })).toEqual({});
    expect(issues({ name: "Ahmed", phone: "01012345678" })).toEqual({});
    expect(issues({ name: "Ahmed", phone: "12345" })).toEqual({ phone: "validation.invalid_phone" });
  });
});

describe("profile form payload", () => {
  it("fills defaults from the profile, null phone as empty", () => {
    expect(profileFormDefaults({ name: "Ahmed", phone: null as unknown as string })).toEqual({ name: "Ahmed", phone: "" });
    expect(profileFormDefaults(undefined)).toEqual({ name: "", phone: "" });
  });

  it("sends the phone in international format and null when cleared", () => {
    expect(toProfileUpdate({ name: " Ahmed ", phone: "010-1234-5678" })).toEqual({ name: "Ahmed", phone: "+201012345678" });
    expect(toProfileUpdate({ name: "Ahmed", phone: "  " })).toEqual({ name: "Ahmed", phone: null });
  });

  it("includes the photo only when it changed", () => {
    expect(toProfileUpdate({ name: "Ahmed", phone: "" })).not.toHaveProperty("avatarUrl");
    expect(toProfileUpdate({ name: "Ahmed", phone: "" }, null)).toMatchObject({ avatarUrl: null });
    expect(toProfileUpdate({ name: "Ahmed", phone: "" }, "https://x/a.png")).toMatchObject({ avatarUrl: "https://x/a.png" });
  });
});

describe("profile save error copy", () => {
  const http = (status: number, data: object = {}) => ({ response: { status, data } });

  it("maps the unowned primary flat 400", () => {
    expect(profileSaveErrorKey(http(400, { message: "user.error.unitNotOwned" }))).toBe("profile.unit_not_owned");
  });

  it("maps transport, throttling and other failures", () => {
    expect(profileSaveErrorKey(new Error("Network Error"))).toBe("errors.unreachable");
    expect(profileSaveErrorKey(http(429))).toBe("errors.rate_limited");
    expect(profileSaveErrorKey(http(400, { message: ["name must be longer"] }))).toBe("profile.save_error");
    expect(profileSaveErrorKey(http(500))).toBe("profile.save_error");
  });
});
