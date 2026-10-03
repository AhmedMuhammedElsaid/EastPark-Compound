/* eslint-disable max-lines-per-function */
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import axios, { AxiosError } from "axios";

import { revokeRefreshToken } from "@/services/api/auth";
import { client, isRefreshExemptUrl, setSessionExpiredHandler } from "@/services/api/client";
import { SECURE_KEY_ACCESS, SECURE_KEY_REFRESH } from "@/services/api/secure-keys";

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

  it("revokes with the current access token when it is still valid", async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => ok(config));

    await revokeRefreshToken();

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[0][0].url).toBe("/auth/logout");
    expect(authHeader(adapter.mock.calls[0][0])).toBe("Bearer old-access");
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({ refreshToken: "refresh-1" });
    expect(refreshPost).not.toHaveBeenCalled();
  });

  it("rotates once and revokes the NEW refresh token when the access token expired", async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (authHeader(config) === "Bearer old-access")
        throw fail(config, 401);
      return ok(config);
    });
    refreshPost.mockResolvedValue({ data: { data: { accessToken: "new-access", refreshToken: "refresh-2" } } });

    await revokeRefreshToken();

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
    await expect(revokeRefreshToken()).resolves.toBeUndefined();
    expect(onExpired).not.toHaveBeenCalled();

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw fail(config);
    });
    await expect(revokeRefreshToken()).resolves.toBeUndefined();
  });

  it("does nothing without a stored refresh token", async () => {
    delete mockSecureStore[SECURE_KEY_REFRESH];
    await revokeRefreshToken();
    expect(adapter).not.toHaveBeenCalled();
  });

  function always401Logout() {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw fail(config, 401);
    });
  }
});
