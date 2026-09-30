import type { AuthUser } from "@/store/slices/auth-slice";

import { client } from "./client";

export const usersApi = {
  getProfile: () =>
    client.get<{ data: AuthUser }>("/user/profile"),

  updateProfile: (data: Partial<Pick<AuthUser, "name" | "phone" | "unitNumber" | "avatarUrl">>) =>
    client.put<{ data: AuthUser }>("/user", data),

  deleteAccount: () =>
    client.delete<{ data: { success: boolean } }>("/user"),
};
