/* eslint-disable max-lines-per-function */
import {
  SECURE_KEY_ACCESS,
  SECURE_KEY_BIOMETRIC_EMAIL,
  SECURE_KEY_BIOMETRIC_ENABLED,
  SECURE_KEY_REFRESH,
} from "@/services/api/secure-keys";

const mockSecureStore: Record<string, string> = {};
const mockEvents: string[] = [];
const mockState = { auth: { isAuthenticated: false, pendingRedirect: null as string | null } };
const mockDispatch = jest.fn();
const mockRefresh = jest.fn();
const mockLogout = jest.fn();
const mockGetProfile = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args) } }));
jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn() }));
jest.mock("@/store", () => ({
  store: { getState: () => mockState, dispatch: (a: unknown) => mockDispatch(a) },
  useAppDispatch: jest.fn(),
}));
jest.mock("@/lib/secure-storage", () => ({
  getSecureItem: jest.fn(async (k: string) => mockSecureStore[k] ?? null),
  setSecureItem: jest.fn(async (k: string, v: string) => {
    mockEvents.push(`set:${k}`);
    mockSecureStore[k] = v;
  }),
  deleteSecureItem: jest.fn(async (k: string) => {
    mockEvents.push(`delete:${k}`);
    delete mockSecureStore[k];
  }),
}));
jest.mock("@/services/api/auth", () => ({
  authApi: {
    refresh: (...args: unknown[]) => mockRefresh(...args),
    logout: (...args: unknown[]) => mockLogout(...args),
  },
  revokeRefreshToken: jest.fn(async () => {}),
}));
jest.mock("@/services/api/client", () => jest.requireActual("@/services/api/secure-keys"));
jest.mock("@/services/api/users", () => ({ usersApi: { getProfile: (...args: unknown[]) => mockGetProfile(...args) } }));
jest.mock("@/services/push", () => ({ clearRegisteredPushToken: jest.fn(), registerPushToken: jest.fn() }));
jest.mock("@/services/query/client", () => ({ queryClient: { clear: jest.fn() } }));
jest.mock("@/services/socket/client", () => ({ disconnectSocket: jest.fn() }));

const { rehydrateSession } = require("@/lib/hooks/use-auth-rehydration");
const { signInWithKeptBiometricSession } = require("./session");

const owner = { id: "u1", email: "OWNER@example.com", name: "O", role: "RESIDENT" };
const other = { id: "u2", email: "other@example.com", name: "X", role: "RESIDENT" };

function httpError(status?: number) {
  return Object.assign(new Error(status ? `HTTP ${status}` : "Network Error"), status ? { response: { status } } : {});
}

function rotated() {
  return { data: { data: { accessToken: "new-access", refreshToken: "rotated-refresh" } } };
}

function loginDispatches() {
  return mockDispatch.mock.calls.filter(([a]) => (a as { type?: string })?.type === "auth/login");
}

beforeEach(() => {
  Object.keys(mockSecureStore).forEach(k => delete mockSecureStore[k]);
  mockSecureStore[SECURE_KEY_REFRESH] = "kept-refresh";
  mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED] = "1";
  mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL] = "owner@example.com";
  mockEvents.length = 0;
  mockState.auth.isAuthenticated = false;
  mockDispatch.mockReset();
  mockRefresh.mockReset();
  mockLogout.mockReset();
  mockLogout.mockResolvedValue({});
  mockGetProfile.mockReset();
  mockReplace.mockReset();
});

describe("biometric sign-in (RW-5b)", () => {
  it("profile fetch fails: no access token stored, rotated refresh kept, and a relaunch does not sign in", async () => {
    mockRefresh.mockResolvedValue(rotated());
    mockGetProfile.mockRejectedValue(httpError());

    await expect(signInWithKeptBiometricSession()).resolves.toBe("unreachable");

    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBeUndefined();
    expect(mockEvents).not.toContain(`set:${SECURE_KEY_ACCESS}`);
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("rotated-refresh");
    expect(mockGetProfile).toHaveBeenCalledWith("new-access");

    mockGetProfile.mockClear();
    const dispatch = jest.fn();
    await rehydrateSession(dispatch);
    expect(mockGetProfile).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("5xx from the profile also stores no access token", async () => {
    mockRefresh.mockResolvedValue(rotated());
    mockGetProfile.mockRejectedValue(httpError(503));

    await expect(signInWithKeptBiometricSession()).resolves.toBe("unreachable");
    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBeUndefined();
  });

  it("account mismatch: local tokens and preference are deleted before the revoke settles", async () => {
    mockRefresh.mockResolvedValue(rotated());
    mockGetProfile.mockResolvedValue({ data: { data: other } });
    // The revoke never answers: the sign-in must not wait for it.
    mockLogout.mockImplementation(() => new Promise(() => {}));

    await expect(signInWithKeptBiometricSession()).resolves.toBe("account_mismatch");
    await Promise.resolve();

    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL]).toBeUndefined();
    expect(mockLogout).toHaveBeenCalledWith("rotated-refresh", "new-access", { timeout: expect.any(Number) });
    expect(mockEvents).not.toContain(`set:${SECURE_KEY_ACCESS}`);
    expect(loginDispatches()).toHaveLength(0);
  });

  it("mismatch is checked against the binding stored NOW, not a stale screen state", async () => {
    mockRefresh.mockResolvedValue(rotated());
    mockGetProfile.mockResolvedValue({ data: { data: owner } });
    // Biometric was rebound to another account after the screen mounted.
    mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL] = "other@example.com";

    await expect(signInWithKeptBiometricSession()).resolves.toBe("account_mismatch");
    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBeUndefined();
  });

  it.each([401, 403])("refresh rejected (%i): kept session forgotten, no access token left", async (status) => {
    mockSecureStore[SECURE_KEY_ACCESS] = "stale-access";
    mockRefresh.mockRejectedValue(httpError(status));

    await expect(signInWithKeptBiometricSession()).resolves.toBe("expired");

    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBeUndefined();
  });

  it.each([401, 403])("profile rejected (%i): no access token left", async (status) => {
    mockRefresh.mockResolvedValue(rotated());
    mockGetProfile.mockRejectedValue(httpError(status));

    await expect(signInWithKeptBiometricSession()).resolves.toBe("expired");

    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBeUndefined();
  });

  it("refresh offline: kept token and preference survive for a retry", async () => {
    mockRefresh.mockRejectedValue(httpError());

    await expect(signInWithKeptBiometricSession()).resolves.toBe("unreachable");
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("kept-refresh");
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBe("1");
  });

  it("match: completeLogin runs once and is the only writer of the access token", async () => {
    mockRefresh.mockResolvedValue(rotated());
    mockGetProfile.mockResolvedValue({ data: { data: owner } });

    await expect(signInWithKeptBiometricSession()).resolves.toBe("signed_in");

    expect(loginDispatches()).toHaveLength(1);
    expect(mockEvents.filter(e => e === `set:${SECURE_KEY_ACCESS}`)).toHaveLength(1);
    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBe("new-access");
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("rotated-refresh");
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBe("1");
    expect(mockReplace).toHaveBeenCalledTimes(1);
    // The access token went to the profile call only after the identity check passed.
    expect(mockEvents.indexOf(`set:${SECURE_KEY_ACCESS}`)).toBeGreaterThan(mockEvents.indexOf(`set:${SECURE_KEY_REFRESH}`));
  });

  it("a password login that finishes during the refresh wins: biometric aborts and stores nothing", async () => {
    mockRefresh.mockImplementation(async () => {
      mockSecureStore[SECURE_KEY_ACCESS] = "password-access";
      mockSecureStore[SECURE_KEY_REFRESH] = "password-refresh";
      mockState.auth.isAuthenticated = true;
      return rotated();
    });

    await expect(signInWithKeptBiometricSession()).resolves.toBe("aborted");

    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBe("password-access");
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("password-refresh");
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBe("1");
    expect(mockEvents).toEqual([]);
    expect(mockGetProfile).not.toHaveBeenCalled();
    expect(loginDispatches()).toHaveLength(0);
    // The orphaned rotated pair is revoked in the background.
    expect(mockLogout).toHaveBeenCalledWith("rotated-refresh", "new-access", { timeout: expect.any(Number) });
  });

  it("a password login that finishes during the profile fetch wins too", async () => {
    mockRefresh.mockResolvedValue(rotated());
    mockGetProfile.mockImplementation(async () => {
      mockSecureStore[SECURE_KEY_ACCESS] = "password-access";
      mockSecureStore[SECURE_KEY_REFRESH] = "password-refresh";
      mockState.auth.isAuthenticated = true;
      return { data: { data: other } };
    });

    await expect(signInWithKeptBiometricSession()).resolves.toBe("aborted");

    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBe("password-access");
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("password-refresh");
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBe("1");
    expect(loginDispatches()).toHaveLength(0);
  });

  it("does nothing when already signed in", async () => {
    mockState.auth.isAuthenticated = true;
    await expect(signInWithKeptBiometricSession()).resolves.toBe("aborted");
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("no kept refresh token: preference forgotten", async () => {
    delete mockSecureStore[SECURE_KEY_REFRESH];
    await expect(signInWithKeptBiometricSession()).resolves.toBe("no_kept_session");
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBeUndefined();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("rehydrateSession", () => {
  it("restores a stored access + refresh pair", async () => {
    mockSecureStore[SECURE_KEY_ACCESS] = "a";
    mockSecureStore[SECURE_KEY_REFRESH] = "r";
    mockGetProfile.mockResolvedValue({ data: { data: owner } });
    const dispatch = jest.fn();

    await rehydrateSession(dispatch);

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "auth/login" }));
  });

  it("deletes a lone access token instead of restoring or attaching it", async () => {
    mockSecureStore[SECURE_KEY_ACCESS] = "a";
    delete mockSecureStore[SECURE_KEY_REFRESH];
    const dispatch = jest.fn();

    await rehydrateSession(dispatch);

    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBeUndefined();
    expect(mockGetProfile).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("keeps a lone (biometric) refresh token and stays signed out", async () => {
    const dispatch = jest.fn();
    await rehydrateSession(dispatch);
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("kept-refresh");
    expect(dispatch).not.toHaveBeenCalled();
  });
});
