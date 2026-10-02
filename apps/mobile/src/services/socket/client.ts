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
 * - Call disconnectSocket() on logout and account deletion.
 */

import type { Socket } from "socket.io-client";

import Env from "env";
import { io } from "socket.io-client";
import { getSecureItem } from "@/lib/secure-storage";

import { SECURE_KEY_ACCESS } from "@/services/api/secure-keys";

export const ORDER_JOIN_EVENT = "order:join";
export const ORDER_LEAVE_EVENT = "order:leave";
export const ORDER_STATUS_UPDATE_EVENT = "order:status_update";

export type OrderStatusUpdate = {
  orderId: string;
  status: string;
  timestamp?: string;
};

let socket: Socket | null = null;
const joinedRooms = new Set<string>();

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

  socket.on("connect", rejoinRooms);

  return socket;
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
  joinedRooms.clear();
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  socket = null;
}
