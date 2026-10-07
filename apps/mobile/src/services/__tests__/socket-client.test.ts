import { EventEmitter } from "node:events";

const mockRefresh = jest.fn();

jest.mock("env", () => ({
  __esModule: true,
  default: { EXPO_PUBLIC_SOCKET_URL: "http://api.test" },
}), { virtual: true });
jest.mock("@/lib/secure-storage", () => ({ getSecureItem: jest.fn(async () => "tok") }));
jest.mock("@/services/api/client", () => ({ refreshAccessToken: () => mockRefresh() }));

class FakeSocket extends EventEmitter {
  connected = false;
  active = true;
  connect = jest.fn();
  disconnect = jest.fn();
}
let mockFake: FakeSocket;
jest.mock("socket.io-client", () => ({ io: () => mockFake }));

// eslint-disable-next-line import/first
import { disconnectSocket, getOrdersSocket, getRecoveryDelay } from "@/services/socket/client";

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("orders socket recovery", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRefresh.mockReset().mockResolvedValue("new");
    mockFake = new FakeSocket();
    disconnectSocket();
  });
  afterEach(() => {
    disconnectSocket();
    jest.useRealTimers();
  });

  it("caps the backoff", () => {
    expect(getRecoveryDelay(0)).toBe(2000);
    expect(getRecoveryDelay(2)).toBe(8000);
    expect(getRecoveryDelay(10)).toBe(30_000);
  });

  it("refreshes the token then reconnects after a server disconnect", async () => {
    getOrdersSocket();
    mockFake.emit("disconnect", "io server disconnect");
    expect(mockRefresh).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2000);
    await flush();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockFake.connect).toHaveBeenCalledTimes(1);
  });

  it("ignores ordinary disconnects and still-retrying connect errors", async () => {
    getOrdersSocket();
    mockFake.emit("disconnect", "transport close");
    mockFake.emit("connect_error", new Error("x"));
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("recovers from a connect_error on an inactive socket and retries when refresh fails", async () => {
    getOrdersSocket();
    mockFake.active = false;
    mockRefresh.mockRejectedValueOnce(new Error("offline"));
    mockFake.emit("connect_error", new Error("unauthorized"));
    jest.advanceTimersByTime(2000);
    await flush();
    expect(mockFake.connect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(4000);
    await flush();
    expect(mockFake.connect).toHaveBeenCalledTimes(1);
  });

  it("stops recovering after logout", async () => {
    getOrdersSocket();
    mockFake.emit("disconnect", "io server disconnect");
    disconnectSocket();
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockFake.connect).not.toHaveBeenCalled();
  });
});
