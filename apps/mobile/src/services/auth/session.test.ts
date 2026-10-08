import {
  SECURE_KEY_ACCESS,
  SECURE_KEY_BIOMETRIC_EMAIL,
  SECURE_KEY_BIOMETRIC_ENABLED,
  SECURE_KEY_REFRESH,
} from "@/services/api/secure-keys";

const mockSecureStore: Record<string, string> = {};
const mockRevoke = jest.fn(async () => {});

jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("@/lib/secure-storage", () => ({
  getSecureItem: jest.fn(async (k: string) => mockSecureStore[k] ?? null),
  setSecureItem: jest.fn(async (k: string, v: string) => {
    mockSecureStore[k] = v;
  }),
  deleteSecureItem: jest.fn(async (k: string) => {
    delete mockSecureStore[k];
  }),
}));
jest.mock("@/services/api/auth", () => ({ revokeRefreshToken: () => mockRevoke() }));
jest.mock("@/services/push", () => ({ clearRegisteredPushToken: jest.fn(), registerPushToken: jest.fn() }));
jest.mock("@/services/query/client", () => ({ queryClient: { clear: jest.fn() } }));
jest.mock("@/services/socket/client", () => ({ disconnectSocket: jest.fn() }));

const { DEFAULT_HOME_ROUTE, completeLogin, getPostLoginRoute, signOut } = require("./session");

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

function seedOwnerBiometric() {
  Object.keys(mockSecureStore).forEach(k => delete mockSecureStore[k]);
  mockSecureStore[SECURE_KEY_REFRESH] = "owner-kept-refresh";
  mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED] = "1";
  mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL] = "owner@example.com";
}

const resident = { id: "u2", email: "Resident@Example.com", name: "R", role: "RESIDENT" };
const owner = { id: "u1", email: "OWNER@example.com", name: "O", role: "SUPER_ADMIN" };

describe("biometric binding across logins (RW-5)", () => {
  beforeEach(() => {
    seedOwnerBiometric();
    mockRevoke.mockClear();
  });

  it("a password login by a different account clears biometric and stores only the new tokens", async () => {
    await completeLogin({ user: resident, accessToken: "res-access", refreshToken: "res-refresh" });

    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBe("res-access");
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("res-refresh");
  });

  it("a login by the same account keeps biometric on", async () => {
    await completeLogin({ user: owner, accessToken: "own-access", refreshToken: "own-refresh" });

    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBe("1");
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL]).toBe("owner@example.com");
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("own-refresh");
  });

  it("sign-out revokes and deletes the token when biometric is bound to another account", async () => {
    mockSecureStore[SECURE_KEY_ACCESS] = "res-access";
    mockSecureStore[SECURE_KEY_REFRESH] = "res-refresh";

    await signOut(resident.email);

    expect(mockRevoke).toHaveBeenCalledTimes(1);
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL]).toBeUndefined();
  });

  it("sign-out revokes and deletes the token when biometric is off", async () => {
    delete mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED];
    delete mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL];

    await signOut(owner.email);

    expect(mockRevoke).toHaveBeenCalledTimes(1);
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBeUndefined();
  });

  it("sign-out keeps the token without revoking only for the bound account", async () => {
    mockSecureStore[SECURE_KEY_ACCESS] = "own-access";

    await signOut(owner.email);

    expect(mockRevoke).not.toHaveBeenCalled();
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("owner-kept-refresh");
    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBe("1");
  });
});
