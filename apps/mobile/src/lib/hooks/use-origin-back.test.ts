import { getOriginRoute } from "./use-origin-back";

describe("getOriginRoute", () => {
  it("maps known origins to their tab route", () => {
    expect(getOriginRoute("home")).toBe("/(tabs)");
    expect(getOriginRoute("profile")).toBe("/(tabs)/profile");
  });

  it("takes the first value of a repeated param", () => {
    expect(getOriginRoute(["home", "profile"])).toBe("/(tabs)");
  });

  it("ignores missing and unknown origins", () => {
    expect(getOriginRoute(undefined)).toBeUndefined();
    expect(getOriginRoute("elsewhere")).toBeUndefined();
    expect(getOriginRoute("toString")).toBeUndefined();
  });
});
