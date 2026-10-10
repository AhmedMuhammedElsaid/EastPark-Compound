/* eslint-disable max-lines-per-function */
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import axios, { AxiosError } from "axios";

import { revokeRefreshToken } from "@/services/api/auth";
import { client, injectStore, isRefreshExemptUrl, setSessionExpiredHandler } from "@/services/api/client";
import { SECURE_KEY_ACCESS, SECURE_KEY_REFRESH } from "@/services/api/secure-keys";
import { bumpSessionEpoch, withAuthStorageLock } from "@/services/api/session-epoch";

jest.mock("env", () => ({
  __esModule: true,
  default: { EXPO_PUBLIC_API_URL: "http://api.test", EXPO_PUBLIC_SOCKET_URL: "http://api.test", EXPO_PUBLIC_VERSION: "1.0.0" },
}), { virtual: true });

const mockSecureStore: Record<string, string | null> = {};
jest.mock("@/lib/secure-storage", () => ({
  getSecureItem: jest.fn(async (k: string) => mockSecureStore[k] ?? null),
  setSecureItem: jest.fn(async (k: string, v: string) => {
    mockSecureStore[k] = v;
  }),
  deleteSecureItem: jest.fn(async (k: string) => {
    delete mockSecureStore[k];
  }),
}));

function ok(config: InternalAxiosRequestConfig, data: unknown = { data: "ok" }): AxiosResponse {
  return { data, status: 200, statusText: "OK", headers: {}, config };
}

function fail(config: InternalAxiosRequestConfig, status?: number): AxiosError {
  const response = status
    ? { data: {}, status, statusText: "", headers: {}, config } as AxiosResponse
    : undefined;
  return new AxiosError(status ? `HTTP ${status}` : "Network Error", status ? "ERR_BAD_RESPONSE" : "ERR_NETWORK", config, null, response);
}

const authHeader = (config: InternalAxiosRequestConfig) => String(config.headers.Authorization ?? "");
const bareConfig = { headers: {} } as InternalAxiosRequestConfig;

describe("api client 401 refresh interceptor", () => {
  let adapter: jest.Mock;
  let onExpired: jest.Mock;
  let refreshPost: jest.SpyInstance;

  beforeEach(() => {
    Object.keys(mockSecureStore).forEach(k => delete mockSecureStore[k]);
    adapter = jest.fn();
    client.defaults.adapter = adapter as unknown as AxiosAdapter;
    onExpired = jest.fn();
    setSessionExpiredHandler(onExpired);
    refreshPost = jest.spyOn(axios, "post");
  });

  afterEach(() => {
    refreshPost.mockRestore();
  });

  function signedIn() {
    mockSecureStore[SECURE_KEY_ACCESS] = "old-access";
    mockSecureStore[SECURE_KEY_REFRESH] = "refresh-1";
  }

  function always401() {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw fail(config, 401);
    });
  }

  it("refreshes with the refresh token as Bearer header (and body), then retries", async () => {
    signedIn();
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (authHeader(config) === "Bearer old-access")
        throw fail(config, 401);
      return ok(config);
    });
    refreshPost.mockResolvedValue({ data: { data: { accessToken: "new-access", refreshToken: "refresh-2" } } });

    const res = await client.get("/orders");

    expect(res.data).toEqual({ data: "ok" });
    expect(refreshPost).toHaveBeenCalledTimes(1);
    const [url, body, config] = refreshPost.mock.calls[0];
    expect(url).toBe("http://api.test/v1/auth/refresh");
    expect(body).toEqual({ refreshToken: "refresh-1" });
    expect(config.headers.Authorization).toBe("Bearer refresh-1");
    expect(authHeader(adapter.mock.calls[1][0])).toBe("Bearer new-access");
    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBe("new-access");
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("refresh-2");
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("never refreshes for public /auth/* endpoints", async () => {
    signedIn();
    always401();

    await expect(client.post("/auth/login", { email: "a@b.c", password: "x" })).rejects.toMatchObject({ response: { status: 401 } });
    expect(refreshPost).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
    expect(isRefreshExemptUrl("/auth/refresh")).toBe(true);
    expect(isRefreshExemptUrl("/auth/push-token")).toBe(false);
  });

  it("does not refresh when there is no refresh token (guest)", async () => {
    always401();

    await expect(client.get("/orders")).rejects.toMatchObject({ response: { status: 401 } });
    expect(refreshPost).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("ends the session when signed in but no refresh token is stored", async () => {
    mockSecureStore[SECURE_KEY_ACCESS] = "old-access";
    always401();

    const err = await client.get("/orders").catch(e => e);

    expect(err.response.status).toBe(401);
    expect(err.config.url).toBe("/orders");
    expect(refreshPost).not.toHaveBeenCalled();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("keeps the session on a refresh network error and propagates the original error", async () => {
    signedIn();
    always401();
    refreshPost.mockRejectedValue(fail(bareConfig));

    const err = await client.get("/orders").catch(e => e);

    expect(err.response.status).toBe(401);
    expect(err.config.url).toBe("/orders");
    expect(onExpired).not.toHaveBeenCalled();
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("refresh-1");
  });

  it("keeps the session when refresh fails with 5xx", async () => {
    signedIn();
    always401();
    refreshPost.mockRejectedValue(fail(bareConfig, 503));

    await expect(client.get("/orders")).rejects.toMatchObject({ response: { status: 401 } });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("ends the session only when the refresh token is rejected (401/403)", async () => {
    signedIn();
    always401();
    refreshPost.mockRejectedValue(fail(bareConfig, 401));

    await expect(client.get("/orders")).rejects.toMatchObject({ response: { status: 401 } });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite an explicit Authorization header", async () => {
    mockSecureStore[SECURE_KEY_ACCESS] = "access";
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => ok(config));

    await client.get("/x", { headers: { Authorization: "Bearer explicit" } });

    expect(authHeader(adapter.mock.calls[0][0])).toBe("Bearer explicit");
  });
});

describe("concurrent 401s with single-use refresh tokens", () => {
  let adapter: jest.Mock;
  let refreshPost: jest.SpyInstance;

  beforeEach(() => {
    Object.keys(mockSecureStore).forEach(k => delete mockSecureStore[k]);
    adapter = jest.fn();
    client.defaults.adapter = adapter as unknown as AxiosAdapter;
    setSessionExpiredHandler(jest.fn());
    refreshPost = jest.spyOn(axios, "post");
  });

  afterEach(() => {
    refreshPost.mockRestore();
  });

  it("issues exactly one refresh call and retries every request with the new token", async () => {
    mockSecureStore[SECURE_KEY_ACCESS] = "old-access";
    mockSecureStore[SECURE_KEY_REFRESH] = "refresh-1";
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (authHeader(config) !== "Bearer new-access")
        throw fail(config, 401);
      return ok(config, { data: config.url });
    });
    let release: () => void = () => {};
    refreshPost.mockImplementation(() => new Promise((resolve) => {
      release = () => resolve({ data: { data: { accessToken: "new-access", refreshToken: "refresh-2" } } });
    }));

    const pending = Promise.all([client.get("/a"), client.get("/b"), client.get("/c")]);
    await new Promise(r => setTimeout(r, 20));
    release();
    const results = await pending;

    expect(refreshPost).toHaveBeenCalledTimes(1);
    expect(results.map(r => r.data.data)).toEqual(["/a", "/b", "/c"]);
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("refresh-2");
  });

  it("retries with the already-rotated token instead of refreshing again", async () => {
    mockSecureStore[SECURE_KEY_ACCESS] = "new-access";
    mockSecureStore[SECURE_KEY_REFRESH] = "refresh-2";
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (authHeader(config) !== "Bearer new-access")
        throw fail(config, 401);
      return ok(config);
    });

    await client.get("/late", { headers: { Authorization: "Bearer old-access" } });

    expect(refreshPost).not.toHaveBeenCalled();
  });
});

describe("revokeRefreshToken (logout)", () => {
  let adapter: jest.Mock;
  let refreshPost: jest.SpyInstance;
  let onExpired: jest.Mock;

  beforeEach(() => {
    Object.keys(mockSecureStore).forEach(k => delete mockSecureStore[k]);
    mockSecureStore[SECURE_KEY_ACCESS] = "old-access";
    mockSecureStore[SECURE_KEY_REFRESH] = "refresh-1";
    adapter = jest.fn();
    client.defaults.adapter = adapter as unknown as AxiosAdapter;
    onExpired = jest.fn();
    setSessionExpiredHandler(onExpired);
    refreshPost = jest.spyOn(axios, "post");
  });

  afterEach(() => {
    refreshPost.mockRestore();
  });

  it("revokes with the captured access token when it is still valid", async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => ok(config));

    await revokeRefreshToken("refresh-1", "old-access");

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[0][0].url).toBe("/auth/logout");
    expect(authHeader(adapter.mock.calls[0][0])).toBe("Bearer old-access");
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({ refreshToken: "refresh-1" });
    expect(refreshPost).not.toHaveBeenCalled();
  });

  it("never attaches a stored access token (it may belong to a newer session)", async () => {
    mockSecureStore[SECURE_KEY_ACCESS] = "newer-session-access";
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => ok(config));
    refreshPost.mockResolvedValue({ data: { data: { accessToken: "new-access", refreshToken: "refresh-2" } } });

    await revokeRefreshToken("refresh-1", null);

    expect(refreshPost).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(authHeader(adapter.mock.calls[0][0])).toBe("Bearer new-access");
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({ refreshToken: "refresh-2" });
  });

  it("rotates once and revokes the NEW refresh token when the access token expired", async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (authHeader(config) === "Bearer old-access")
        throw fail(config, 401);
      return ok(config);
    });
    refreshPost.mockResolvedValue({ data: { data: { accessToken: "new-access", refreshToken: "refresh-2" } } });

    await revokeRefreshToken("refresh-1", "old-access");

    expect(refreshPost).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(2);
    const retry = adapter.mock.calls[1][0];
    expect(authHeader(retry)).toBe("Bearer new-access");
    expect(JSON.parse(retry.data)).toEqual({ refreshToken: "refresh-2" });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("never throws when the refresh token is already rejected or offline", async () => {
    always401Logout();
    refreshPost.mockRejectedValue(fail(bareConfig, 401));
    await expect(revokeRefreshToken("refresh-1", "old-access")).resolves.toBeUndefined();
    expect(onExpired).not.toHaveBeenCalled();

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw fail(config);
    });
    await expect(revokeRefreshToken("refresh-1", "old-access")).resolves.toBeUndefined();
  });

  it("does nothing without a refresh token", async () => {
    await revokeRefreshToken(null, "old-access");
    expect(adapter).not.toHaveBeenCalled();
    expect(refreshPost).not.toHaveBeenCalled();
  });

  function always401Logout() {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw fail(config, 401);
    });
  }
});

describe("401 while signed out", () => {
  let adapter: jest.Mock;
  let refreshPost: jest.SpyInstance;

  beforeEach(() => {
    Object.keys(mockSecureStore).forEach(k => delete mockSecureStore[k]);
    adapter = jest.fn();
    client.defaults.adapter = adapter as unknown as AxiosAdapter;
    setSessionExpiredHandler(jest.fn());
    refreshPost = jest.spyOn(axios, "post");
  });

  afterEach(() => {
    refreshPost.mockRestore();
    injectStore(null as never);
  });

  it("never refreshes with a biometric-kept refresh token", async () => {
    injectStore({ getState: () => ({ auth: { isAuthenticated: false } }), dispatch: jest.fn() } as never);
    mockSecureStore[SECURE_KEY_ACCESS] = "old-access";
    mockSecureStore[SECURE_KEY_REFRESH] = "refresh-1";
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw fail(config, 401);
    });

    await expect(client.get("/orders")).rejects.toMatchObject({ response: { status: 401 } });

    expect(refreshPost).not.toHaveBeenCalled();
    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBe("old-access");
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("refresh-1");
  });

  it("never refreshes when biometric sign-in checks a profile with an explicit, unstored access token", async () => {
    injectStore({ getState: () => ({ auth: { isAuthenticated: false } }), dispatch: jest.fn() } as never);
    mockSecureStore[SECURE_KEY_REFRESH] = "rotated-refresh";
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw fail(config, 401);
    });

    await expect(client.get("/user/profile", { headers: { Authorization: "Bearer fresh-access" } }))
      .rejects
      .toMatchObject({ response: { status: 401 } });

    expect(refreshPost).not.toHaveBeenCalled();
    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("rotated-refresh");
  });
});

describe("sign-out / sign-in while a refresh is in flight", () => {
  let adapter: jest.Mock;
  let refreshPost: jest.SpyInstance;
  let onExpired: jest.Mock;
  let dispatch: jest.Mock;
  let authState: { isAuthenticated: boolean };
  let releaseRefresh: (outcome: { tokens?: { accessToken: string; refreshToken: string }; status?: number }) => void;

  beforeEach(() => {
    Object.keys(mockSecureStore).forEach(k => delete mockSecureStore[k]);
    mockSecureStore[SECURE_KEY_ACCESS] = "old-access";
    mockSecureStore[SECURE_KEY_REFRESH] = "refresh-1";
    authState = { isAuthenticated: true };
    dispatch = jest.fn();
    injectStore({ getState: () => ({ auth: authState }), dispatch } as never);
    adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
      if (authHeader(config) === "Bearer new-access" || authHeader(config) === "Bearer b-access")
        return ok(config);
      throw fail(config, 401);
    });
    client.defaults.adapter = adapter as unknown as AxiosAdapter;
    onExpired = jest.fn();
    setSessionExpiredHandler(onExpired);
    refreshPost = jest.spyOn(axios, "post").mockImplementation(((url: string) => {
      if (!url.endsWith("/auth/refresh"))
        return Promise.resolve({ data: { data: { message: "ok" } } });
      return new Promise((resolve, reject) => {
        releaseRefresh = ({ tokens, status }) => tokens
          ? resolve({ data: { data: tokens } })
          : reject(fail(bareConfig, status));
      });
    }) as never);
  });

  afterEach(() => {
    refreshPost.mockRestore();
    injectStore(null as never);
  });

  const refreshCalls = () => refreshPost.mock.calls.filter(c => String(c[0]).endsWith("/auth/refresh"));
  const logoutCalls = () => refreshPost.mock.calls.filter(c => String(c[0]).endsWith("/auth/logout"));
  const tick = () => new Promise(r => setTimeout(r, 10));

  /** Mirrors teardownSession's token handling. */
  async function signOutLocally({ keepRefreshToken }: { keepRefreshToken: boolean }) {
    bumpSessionEpoch();
    await withAuthStorageLock(async () => {
      delete mockSecureStore[SECURE_KEY_ACCESS];
      if (!keepRefreshToken)
        delete mockSecureStore[SECURE_KEY_REFRESH];
    });
    authState.isAuthenticated = false;
  }

  it("full sign-out: the rotated pair is never stored or dispatched, and is revoked", async () => {
    const pending = client.get("/orders").catch(e => e);
    await tick();
    expect(refreshCalls()).toHaveLength(1);

    await signOutLocally({ keepRefreshToken: false });
    releaseRefresh({ tokens: { accessToken: "new-access", refreshToken: "refresh-2" } });
    const err = await pending;
    await tick();

    expect(err.response.status).toBe(401);
    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
    // Not replayed with any token.
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(logoutCalls()).toHaveLength(1);
    const [, body, config] = logoutCalls()[0];
    expect(body).toEqual({ refreshToken: "refresh-2" });
    expect(config.headers.Authorization).toBe("Bearer new-access");
  });

  it("biometric sign-out: the rotated refresh token replaces the spent kept one, nothing else is stored", async () => {
    const pending = client.get("/orders").catch(e => e);
    await tick();

    await signOutLocally({ keepRefreshToken: true });
    releaseRefresh({ tokens: { accessToken: "new-access", refreshToken: "refresh-2" } });
    await pending;
    await tick();

    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("refresh-2");
    expect(dispatch).not.toHaveBeenCalled();
    expect(logoutCalls()).toHaveLength(0);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("sign-out then another sign-in: the new session's tokens win and the old pair is revoked", async () => {
    const pending = client.get("/orders").catch(e => e);
    await tick();

    await signOutLocally({ keepRefreshToken: false });
    bumpSessionEpoch();
    await withAuthStorageLock(async () => {
      mockSecureStore[SECURE_KEY_ACCESS] = "b-access";
      mockSecureStore[SECURE_KEY_REFRESH] = "b-refresh";
    });
    authState.isAuthenticated = true;
    releaseRefresh({ tokens: { accessToken: "new-access", refreshToken: "refresh-2" } });
    await pending;
    await tick();

    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBe("b-access");
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("b-refresh");
    expect(dispatch).not.toHaveBeenCalled();
    expect(logoutCalls()).toHaveLength(1);
    expect(logoutCalls()[0][1]).toEqual({ refreshToken: "refresh-2" });
  });

  it("a rejected refresh of the old session never tears down the new one", async () => {
    const pending = client.get("/orders").catch(e => e);
    await tick();

    await signOutLocally({ keepRefreshToken: false });
    bumpSessionEpoch();
    mockSecureStore[SECURE_KEY_ACCESS] = "b-access";
    mockSecureStore[SECURE_KEY_REFRESH] = "b-refresh";
    authState.isAuthenticated = true;
    releaseRefresh({ status: 401 });
    await pending;
    await tick();

    expect(onExpired).not.toHaveBeenCalled();
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("b-refresh");
  });

  it("the new session never joins the old session's in-flight refresh", async () => {
    const oldPending = client.get("/orders").catch(e => e);
    await tick();
    const oldRelease = releaseRefresh;

    await signOutLocally({ keepRefreshToken: false });
    bumpSessionEpoch();
    mockSecureStore[SECURE_KEY_ACCESS] = "b-expired";
    mockSecureStore[SECURE_KEY_REFRESH] = "b-refresh";
    authState.isAuthenticated = true;

    const newPending = client.get("/profile");
    await tick();
    expect(refreshCalls()).toHaveLength(2);
    expect(refreshCalls()[1][1]).toEqual({ refreshToken: "b-refresh" });

    releaseRefresh({ tokens: { accessToken: "b-access", refreshToken: "b-refresh-2" } });
    oldRelease({ tokens: { accessToken: "new-access", refreshToken: "refresh-2" } });
    await expect(newPending).resolves.toMatchObject({ status: 200 });
    await oldPending;
    await tick();

    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBe("b-access");
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("b-refresh-2");
    expect(logoutCalls().map(c => c[1])).toEqual([{ refreshToken: "refresh-2" }]);
  });

  it("a 401 for a request sent by an ended session is not refreshed or replayed", async () => {
    let releaseRequest: () => void = () => {};
    adapter.mockImplementationOnce((config: InternalAxiosRequestConfig) => new Promise((_resolve, reject) => {
      releaseRequest = () => reject(fail(config, 401));
    }));
    const pending = client.get("/orders").catch(e => e);
    await tick();

    bumpSessionEpoch();
    mockSecureStore[SECURE_KEY_ACCESS] = "b-access";
    mockSecureStore[SECURE_KEY_REFRESH] = "b-refresh";
    releaseRequest();
    const err = await pending;

    expect(err.response.status).toBe(401);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(refreshCalls()).toHaveLength(0);
  });
});
