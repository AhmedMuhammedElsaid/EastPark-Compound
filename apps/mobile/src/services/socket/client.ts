/**
 * EastPark Socket.io client — /orders namespace
 *
 * Contract (backend OrdersGateway):
 * - Handshake: `auth: { token: <accessToken> }`
 * - Emit `order:join` / `order:leave` with the bare orderId STRING
 * - Listen for `order:status_update` → `{ orderId, status, timestamp }`
 *
 * - One shared socket; reused while connecting or reconnecting.
 * - `auth` is a callback, so every (re)connect reads the CURRENT access token
 *   (the 401 interceptor may have rotated it since the first connect).
 * - Joined rooms are re-joined on every `connect`, because a reconnect loses
 *   server-side room membership.
 * - The gateway disconnects invalid/expired tokens with `io server disconnect`
 *   (and middleware rejections surface as a `connect_error` on an inactive
 *   socket). socket.io-client never auto-reconnects those, so we refresh the
 *   access token through the shared single-flight refresh and reconnect with
 *   capped exponential backoff.
 * - Call disconnectSocket() on logout and account deletion (cancels recovery).
 */

import type { Socket } from "socket.io-client";

import Env from "env";
import { io } from "socket.io-client";
import { getSecureItem } from "@/lib/secure-storage";

import { refreshAccessToken } from "@/services/api/client";
import { SECURE_KEY_ACCESS } from "@/services/api/secure-keys";

export const ORDER_JOIN_EVENT = "order:join";
export const ORDER_LEAVE_EVENT = "order:leave";
export const ORDER_STATUS_UPDATE_EVENT = "order:status_update";

export type OrderStatusUpdate = {
  orderId: string;
  status: string;
  timestamp?: string;
};

export const RECOVERY_BASE_DELAY_MS = 2000;
export const RECOVERY_MAX_DELAY_MS = 30_000;
export const RECOVERY_MAX_ATTEMPTS = 6;

let socket: Socket | null = null;
const joinedRooms = new Set<string>();
let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
let recoveryAttempts = 0;

export function getRecoveryDelay(attempt: number): number {
  return Math.min(RECOVERY_BASE_DELAY_MS * 2 ** attempt, RECOVERY_MAX_DELAY_MS);
}

function cancelRecovery() {
  if (recoveryTimer)
    clearTimeout(recoveryTimer);
  recoveryTimer = null;
  recoveryAttempts = 0;
}

/** Refresh the access token, then reconnect; retries with capped backoff. */
function scheduleRecovery(forSocket: Socket) {
  if (recoveryTimer || recoveryAttempts >= RECOVERY_MAX_ATTEMPTS)
    return;
  const delay = getRecoveryDelay(recoveryAttempts);
  recoveryAttempts += 1;
  recoveryTimer = setTimeout(async () => {
    recoveryTimer = null;
    if (socket !== forSocket)
      return; // logged out / replaced while waiting
    try {
      await refreshAccessToken();
    }
    catch {
      // Refresh failed (offline or rejected). A rejection already ended the
      // session via the expiry handler, which disconnects this socket.
      if (socket === forSocket)
        scheduleRecovery(forSocket);
      return;
    }
    if (socket === forSocket)
      forSocket.connect();
  }, delay);
}

function rejoinRooms() {
  joinedRooms.forEach(orderId => socket?.emit(ORDER_JOIN_EVENT, orderId));
}

export function getOrdersSocket(): Socket {
  if (socket)
    return socket;

  socket = io(`${Env.EXPO_PUBLIC_SOCKET_URL}/orders`, {
    auth: (cb) => {
      getSecureItem(SECURE_KEY_ACCESS)
        .then(token => cb({ token }))
        .catch(() => cb({ token: null }));
    },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  const created = socket;
  created.on("connect", () => {
    recoveryAttempts = 0;
    rejoinRooms();
  });
  created.on("disconnect", (reason: string) => {
    if (reason === "io server disconnect")
      scheduleRecovery(created);
  });
  created.on("connect_error", () => {
    // `active` stays true while socket.io-client is still auto-retrying
    // transport failures; false means it gave up (e.g. auth rejection).
    if (!created.active)
      scheduleRecovery(created);
  });

  return created;
}

export function joinOrderRoom(orderId: string) {
  joinedRooms.add(orderId);
  const s = getOrdersSocket();
  if (s.connected)
    s.emit(ORDER_JOIN_EVENT, orderId);
  // Otherwise the `connect` handler joins it once the handshake completes.
}

export function leaveOrderRoom(orderId: string) {
  joinedRooms.delete(orderId);
  if (socket?.connected)
    socket.emit(ORDER_LEAVE_EVENT, orderId);
}

export function disconnectSocket() {
  cancelRecovery();
  joinedRooms.clear();
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  socket = null;
}
