import {
  SECURE_KEY_ACCESS,
  SECURE_KEY_BIOMETRIC_EMAIL,
  SECURE_KEY_BIOMETRIC_ENABLED,
  SECURE_KEY_REFRESH,
} from "@/services/api/secure-keys";

const mockSecureStore: Record<string, string> = {};
const mockRevoke = jest.fn(async (_refresh?: string | null, _access?: string | null) => {});
const mockEvents: string[] = [];
const mockRevokePush = jest.fn((_push?: string | null) => {});
let mockPushToken: string | null = null;

jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("@/store", () => ({
  store: {
    getState: () => ({ auth: { isAuthenticated: true, pendingRedirect: null } }),
    dispatch: (a: { type?: string }) => {
      mockEvents.push(`dispatch:${a?.type}`);
    },
  },
}));
jest.mock("@/lib/secure-storage", () => ({
  getSecureItem: jest.fn(async (k: string) => mockSecureStore[k] ?? null),
  setSecureItem: jest.fn(async (k: string, v: string) => {
    mockSecureStore[k] = v;
  }),
  deleteSecureItem: jest.fn(async (k: string) => {
    mockEvents.push(`delete:${k}`);
    delete mockSecureStore[k];
  }),
}));
jest.mock("@/services/api/auth", () => ({
  authApi: { refresh: jest.fn(), logout: jest.fn() },
  revokeRefreshToken: (refresh?: string | null, access?: string | null, push?: string | null) => {
    mockEvents.push("revoke");
    mockRevokePush(push);
    return mockRevoke(refresh, access);
  },
}));
jest.mock("@/services/api/users", () => ({ usersApi: { getProfile: jest.fn() } }));
jest.mock("@/services/push", () => ({
  // Teardown forgets the last registered token, like the real module.
  clearRegisteredPushToken: jest.fn(async () => {
    mockPushToken = null;
  }),
  getRegisteredPushToken: jest.fn(async () => mockPushToken),
  registerPushToken: jest.fn(),
}));
jest.mock("@/services/query/client", () => ({ queryClient: { clear: jest.fn() } }));
jest.mock("@/services/socket/client", () => ({ disconnectSocket: jest.fn() }));

const bindingModule = require("@/lib/biometric-binding");
const { DEFAULT_HOME_ROUTE, completeLogin, endDeletedAccountSession, getPostLoginRoute, signOut } = require("./session");

async function flushBackground() {
  for (let i = 0; i < 5; i++)
    await Promise.resolve();
}

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
    mockRevoke.mockReset();
    mockEvents.length = 0;
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
    await flushBackground();

    expect(mockRevoke).toHaveBeenCalledTimes(1);
    expect(mockRevoke).toHaveBeenCalledWith("res-refresh", "res-access");
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL]).toBeUndefined();
  });

  it("sign-out revokes and deletes the token when biometric is off", async () => {
    delete mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED];
    delete mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL];

    await signOut(owner.email);
    await flushBackground();

    expect(mockRevoke).toHaveBeenCalledTimes(1);
    expect(mockRevoke).toHaveBeenCalledWith("owner-kept-refresh", null);
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

describe("sign-out tears down locally before revoking (RW-5c)", () => {
  beforeEach(() => {
    Object.keys(mockSecureStore).forEach(k => delete mockSecureStore[k]);
    mockSecureStore[SECURE_KEY_ACCESS] = "acc";
    mockSecureStore[SECURE_KEY_REFRESH] = "ref";
    mockRevoke.mockReset();
    mockEvents.length = 0;
  });

  function expectSignedOutLocally() {
    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBeUndefined();
    expect(mockEvents).toContain("dispatch:auth/logout");
  }

  it("finishes the local teardown while the revoke hangs, and revokes the captured tokens after it", async () => {
    mockRevoke.mockImplementation(() => new Promise(() => {}));

    await signOut("someone@example.com");
    await flushBackground();

    expectSignedOutLocally();
    expect(mockRevoke).toHaveBeenCalledWith("ref", "acc");
    expect(mockEvents.indexOf("revoke")).toBeGreaterThan(mockEvents.indexOf("dispatch:auth/logout"));
  });

  it("sends the device's push token (captured before teardown forgets it) with the revoke", async () => {
    mockPushToken = "ExponentPushToken[device]";
    mockRevokePush.mockClear();

    await signOut("someone@example.com");
    await flushBackground();

    expectSignedOutLocally();
    expect(mockPushToken).toBeNull();
    expect(mockRevokePush).toHaveBeenCalledWith("ExponentPushToken[device]");
  });

  it("finishes the local teardown when the revoke throws", async () => {
    mockRevoke.mockRejectedValue(new Error("boom"));

    await expect(signOut("someone@example.com")).resolves.toBeUndefined();
    await flushBackground();

    expectSignedOutLocally();
  });

  it("finishes the local teardown when clearing the biometric preference throws", async () => {
    const spy = jest.spyOn(bindingModule, "clearBiometricPreference").mockRejectedValueOnce(new Error("keystore"));

    await signOut("someone@example.com");
    await flushBackground();

    expectSignedOutLocally();
    expect(mockRevoke).toHaveBeenCalledWith("ref", "acc");
    spy.mockRestore();
  });

  it("still signs the store out when a SecureStore delete throws", async () => {
    const storage = require("@/lib/secure-storage");
    const realDelete = storage.deleteSecureItem.getMockImplementation();
    storage.deleteSecureItem.mockImplementation(async (k: string) => {
      if (k === SECURE_KEY_ACCESS)
        throw new Error("keystore");
      return realDelete(k);
    });

    await expect(signOut("someone@example.com")).rejects.toThrow("keystore");
    storage.deleteSecureItem.mockImplementation(realDelete);

    expect(mockEvents).toContain("dispatch:auth/logout");
  });

  it("account delete: local teardown runs even if clearing the preference throws", async () => {
    mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED] = "1";
    const spy = jest.spyOn(bindingModule, "clearBiometricPreference").mockRejectedValueOnce(new Error("keystore"));

    await endDeletedAccountSession();

    expectSignedOutLocally();
    expect(mockRevoke).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("every sign-out and sign-in starts a new session epoch (AUTHGAP)", () => {
  const { getSessionEpoch } = require("@/services/api/session-epoch");

  beforeEach(() => {
    seedOwnerBiometric();
    mockRevoke.mockReset();
    mockEvents.length = 0;
  });

  async function expectEpochBump(action: () => Promise<unknown>) {
    const before = getSessionEpoch();
    await action();
    expect(getSessionEpoch()).toBeGreaterThan(before);
  }

  it("bumps on sign-out with biometric kept", async () => {
    await expectEpochBump(() => signOut(owner.email));
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("owner-kept-refresh");
  });

  it("bumps on sign-out without biometric", async () => {
    await expectEpochBump(() => signOut(resident.email));
  });

  it("bumps on account delete", async () => {
    await expectEpochBump(() => endDeletedAccountSession());
  });

  it("bumps on login", async () => {
    await expectEpochBump(() => completeLogin({ user: owner, accessToken: "a", refreshToken: "r" }));
  });
});
