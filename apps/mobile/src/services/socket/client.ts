/**
 * EastPark Socket.io client — /orders namespace
 * - Authenticated via JWT in handshake auth
 * - Reconnects automatically (5 attempts, 2s delay)
 * - Call disconnectSocket() on logout and when order detail unmounts
 */

import type { Socket } from "socket.io-client";

import Env from "env";
import { io } from "socket.io-client";
import { getSecureItem } from "@/lib/secure-storage";

import { SECURE_KEY_ACCESS } from "@/services/api/client";

let socket: Socket | null = null;

export async function getOrdersSocket(): Promise<Socket> {
  if (socket?.connected)
    return socket;

  const token = await getSecureItem(SECURE_KEY_ACCESS);

  socket = io(`${Env.EXPO_PUBLIC_SOCKET_URL}/orders`, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  return socket;
}

export function joinOrderRoom(orderId: string) {
  socket?.emit("join_order", { orderId });
}

export function leaveOrderRoom(orderId: string) {
  socket?.emit("leave_order", { orderId });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
