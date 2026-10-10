import { pickSavedFields, profileQueryKey } from "./use-profile-units";

jest.mock("@/services/api/users", () => ({ usersApi: { getProfile: jest.fn() } }));

describe("saved profile fields", () => {
  it("keeps only the edited fields the response carries", () => {
    expect(pickSavedFields({ id: "1", name: "Ahmed", phone: "+201012345678", email: "a@x.com", units: [] }))
      .toEqual({ name: "Ahmed", phone: "+201012345678" });
  });

  it("keeps null values (a cleared phone or photo)", () => {
    expect(pickSavedFields({ avatarUrl: null, unitNumber: "A1-1-4" })).toEqual({ avatarUrl: null, unitNumber: "A1-1-4" });
  });

  it("shares one query key per account", () => {
    expect(profileQueryKey("u1")).toEqual(["profile-units", "u1"]);
  });
});
