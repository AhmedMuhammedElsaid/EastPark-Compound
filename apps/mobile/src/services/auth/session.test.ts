jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("@/lib/secure-storage", () => ({ deleteSecureItem: jest.fn(), setSecureItem: jest.fn() }));
jest.mock("@/services/push", () => ({ clearRegisteredPushToken: jest.fn(), registerPushToken: jest.fn() }));
jest.mock("@/services/query/client", () => ({ queryClient: { clear: jest.fn() } }));
jest.mock("@/services/socket/client", () => ({ disconnectSocket: jest.fn() }));

const { DEFAULT_HOME_ROUTE, getPostLoginRoute } = require("./session");

describe("getPostLoginRoute", () => {
  it("sends each role to its home", () => {
    expect(getPostLoginRoute("RESIDENT", null)).toBe(DEFAULT_HOME_ROUTE);
    expect(getPostLoginRoute("MERCHANT", null)).toBe("/(merchant)/dashboard");
    expect(getPostLoginRoute("ADMIN", null)).toBe("/(admin)");
  });

  it("sends SUPER_ADMIN to the admin home", () => {
    expect(getPostLoginRoute("SUPER_ADMIN", undefined)).toBe("/(admin)");
  });

  it("falls back to the default home without a role", () => {
    expect(getPostLoginRoute(undefined, null)).toBe(DEFAULT_HOME_ROUTE);
  });

  it("prefers a pending redirect except for auth routes", () => {
    expect(getPostLoginRoute("SUPER_ADMIN", "/(tabs)/orders")).toBe("/(tabs)/orders");
    expect(getPostLoginRoute("SUPER_ADMIN", "/(auth)/login")).toBe("/(admin)");
  });
});
