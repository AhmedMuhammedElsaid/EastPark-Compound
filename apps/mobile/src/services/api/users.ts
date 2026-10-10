import type { AuthUser } from "@/store/slices/auth-slice";

import { client } from "./client";

export const usersApi = {
  // An explicit access token is sent as-is (biometric sign-in checks whose
  // token it holds before storing it); otherwise the stored one is attached.
  getProfile: (accessToken?: string) =>
    client.get<{ data: AuthUser }>(
      "/user/profile",
      accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
    ),

  /** `PUT /user`. Phone and photo are cleared with null; `unitNumber` picks the primary flat. */
  updateProfile: (data: { name?: string; phone?: string | null; unitNumber?: string | null; avatarUrl?: string | null }) =>
    client.put<{ data: AuthUser }>("/user", data),

  deleteAccount: () =>
    client.delete<{ data: { success: boolean } }>("/user"),
};
