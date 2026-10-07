import { client } from "./client";

/** Roles an admin can invite. */
export type InvitationRole = "MERCHANT" | "ADMIN";
/** Roles the backend can return on an invitation (lead approval creates RESIDENT ones). */
export type InvitationResponseRole = InvitationRole | "RESIDENT" | "SUPER_ADMIN";
export type InvitationStatus = "PENDING" | "USED" | "EXPIRED";

export type Invitation = {
  id: string;
  email: string;
  role: InvitationResponseRole;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

export type LeadStatus = "PENDING" | "INVITED" | "CONVERTED" | "REJECTED";
export type LeadStats = Record<LeadStatus, number> & { total: number };

/** A unit-registration request (`GET /admin/residents/leads`). */
export type ResidentLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  building: string;
  floor: string;
  flatNumber: string;
  status: LeadStatus;
  /** A live account already uses this email: approving adds the flat to it, no invitation is sent. */
  hasAccount?: boolean;
  createdAt: string;
};

type LeadPage = { items: ResidentLead[]; nextCursor: string | null };

export const adminApi = {
  getLeads: (params: { cursor?: string; limit?: number; status?: LeadStatus }) =>
    client.get<{ data: LeadPage }>("/admin/residents/leads", { params }),

  getLeadStats: () => client.get<{ data: LeadStats }>("/admin/residents/leads/stats"),

  /** Invites the lead, or adds the flat to an existing account (`residentLead.success.alreadyRegistered`). */
  inviteLead: (id: string) =>
    client.post<{ message?: string; data?: { message?: string } }>(`/admin/residents/leads/${encodeURIComponent(id)}/invite`),

  rejectLead: (id: string) => client.patch(`/admin/residents/leads/${encodeURIComponent(id)}/reject`),

  sendInvitation: (email: string, role: InvitationRole) =>
    client.post<{ data: Invitation }>("/admin/invitations", { email, role }),

  getInvitations: (params?: { cursor?: string; limit?: number }) =>
    client.get<{ data: { items: Invitation[]; nextCursor: string | null } }>("/admin/invitations", { params }),
};
