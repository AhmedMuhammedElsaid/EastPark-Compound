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
  /** Not in AnnouncementResponseDto today; kept optional for the pinned badge. */
  isPinned?: boolean;
  publishedAt?: string;
  createdAt: string;
};

/** GET /announcements/:id — comments are embedded; there is no separate comments GET. */
export type AnnouncementDetail = Announcement & { comments: Comment[] };

export type Report = {
  id: string;
  title: string;
  titleAr: string;
  pdfUrl: string;
  publishedAt: string;
};

/**
 * CommentResponseDto. `userId` and `user.id` are only sent to the comment's
 * author and to admins; guests get the author's first name only.
 */
export type Comment = {
  id: string;
  body: string;
  userId?: string;
  user: { id?: string; name: string } | null;
  createdAt: string;
};

/** Replies are written by compound management (admins); only authorId is exposed. */
export type FeedbackReply = {
  id: string;
  body: string;
  authorId: string;
  createdAt: string;
};

/** FeedbackResponseDto — there is no title; the body is the whole submission. */
export type Feedback = {
  id: string;
  category: FeedbackCategory;
  body: string;
  status: FeedbackStatus;
  isAnonymous: boolean;
  attachments: string[];
  userId?: string | null;
  /** Only in the detail response (list items omit it). */
  replies?: FeedbackReply[];
  createdAt: string;
  updatedAt?: string;
};

export type FeedbackDetail = Feedback & { replies: FeedbackReply[] };

/** Mirrors FeedbackCreateDto exactly (forbidNonWhitelisted rejects extras). */
export type FeedbackCreatePayload = {
  category: FeedbackCategory;
  body: string;
  isAnonymous?: boolean;
  attachments?: string[];
};

export const communityApi = {
  // Announcements
  getAnnouncements: (params?: { cursor?: string; limit?: number; category?: AnnouncementCategory }) =>
    client.get<{ data: { items: Announcement[]; nextCursor: string | null } }>("/announcements", { params }),

  getAnnouncement: (id: string) =>
    client.get<{ data: AnnouncementDetail }>(`/announcements/${id}`),

  addComment: (announcementId: string, body: string) =>
    client.post<{ data: Comment }>(`/announcements/${announcementId}/comments`, { body }),

  // Reports
  getReports: (params?: { cursor?: string; limit?: number }) =>
    client.get<{ data: { items: Report[]; nextCursor: string | null } }>("/reports", { params }),

  // Feedback
  getFeedback: (params?: { cursor?: string; limit?: number; status?: FeedbackStatus }) =>
    client.get<{ data: { items: Feedback[]; nextCursor: string | null } }>("/feedback", { params }),

  getFeedbackItem: (id: string) =>
    client.get<{ data: FeedbackDetail }>(`/feedback/${id}`),

  submitFeedback: (data: FeedbackCreatePayload) =>
    client.post<{ data: Feedback }>("/feedback", {
      category: data.category,
      body: data.body,
      ...(data.isAnonymous !== undefined ? { isAnonymous: data.isAnonymous } : {}),
      ...(data.attachments?.length ? { attachments: data.attachments } : {}),
    }),

  // Admin
  createAnnouncement: (data: {
    title: string;
    titleAr: string;
    body: string;
    bodyAr: string;
    category: AnnouncementCategory;
  }) => client.post<{ data: Announcement }>("/announcements", data),
};
