import { client } from "./client";

export type AnnouncementCategory = "GENERAL" | "PROMOTION" | "EVENT" | "MAINTENANCE" | "NEWS";
export type FeedbackCategory = "MAINTENANCE" | "SECURITY" | "CLEANLINESS" | "NOISE" | "SUGGESTION" | "OTHER";
export type FeedbackStatus = "SUBMITTED" | "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED";

export type Announcement = {
  id: string;
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
  category: AnnouncementCategory;
  pdfUrl: string | null;
  isPinned: boolean;
  createdAt: string;
};

export type Report = {
  id: string;
  title: string;
  titleAr: string;
  description: string | null;
  pdfUrl: string;
  publishedAt: string;
};

export type Comment = {
  id: string;
  body: string;
  user: { id: string; name: string; avatarUrl: string | null };
  createdAt: string;
};

export type Feedback = {
  id: string;
  category: FeedbackCategory;
  title: string;
  body: string;
  status: FeedbackStatus;
  isAnonymous: boolean;
  attachments: string[];
  replies: Array<{
    id: string;
    body: string;
    author: { name: string } | null;
    createdAt: string;
  }>;
  createdAt: string;
};

export const communityApi = {
  // Announcements
  getAnnouncements: (params?: { cursor?: string; limit?: number; category?: AnnouncementCategory }) =>
    client.get<{ data: { items: Announcement[]; nextCursor: string | null } }>("/announcements", { params }),

  getAnnouncement: (id: string) =>
    client.get<{ data: Announcement }>(`/announcements/${id}`),

  getComments: (announcementId: string, params?: { cursor?: string; limit?: number }) =>
    client.get<{ data: { items: Comment[]; nextCursor: string | null } }>(`/announcements/${announcementId}/comments`, { params }),

  addComment: (announcementId: string, body: string) =>
    client.post<{ data: Comment }>(`/announcements/${announcementId}/comments`, { body }),

  // Reports
  getReports: (params?: { cursor?: string; limit?: number }) =>
    client.get<{ data: { items: Report[]; nextCursor: string | null } }>("/reports", { params }),

  // Feedback
  getFeedback: (params?: { cursor?: string; limit?: number; status?: FeedbackStatus }) =>
    client.get<{ data: { items: Feedback[]; nextCursor: string | null } }>("/feedback", { params }),

  getFeedbackItem: (id: string) =>
    client.get<{ data: Feedback }>(`/feedback/${id}`),

  submitFeedback: (data: {
    category: FeedbackCategory;
    title: string;
    body: string;
    isAnonymous?: boolean;
    attachments?: string[];
  }) => client.post<{ data: Feedback }>("/feedback", data),

  // Admin
  createAnnouncement: (data: {
    title: string;
    titleAr: string;
    body: string;
    bodyAr: string;
    category: AnnouncementCategory;
  }) => client.post<{ data: Announcement }>("/announcements", data),
};
