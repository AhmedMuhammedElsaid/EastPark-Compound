import { client } from "./client";

export type InvitationRole = "MERCHANT" | "ADMIN";
export type InvitationStatus = "PENDING" | "USED" | "EXPIRED";

export type Invitation = {
  id: string;
  email: string;
  role: InvitationRole;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

export const adminApi = {
  sendInvitation: (email: string, role: InvitationRole) =>
    client.post<{ data: Invitation }>("/admin/invitations", { email, role }),

  getInvitations: (params?: { cursor?: string; limit?: number }) =>
    client.get<{ data: { items: Invitation[]; nextCursor: string | null } }>("/admin/invitations", { params }),
};
