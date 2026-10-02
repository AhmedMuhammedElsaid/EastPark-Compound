import { z } from 'zod';

export const feedbackCategories = [
  'MAINTENANCE',
  'SECURITY',
  'CLEANLINESS',
  'NOISE',
  'SUGGESTION',
  'OTHER',
] as const;

export const feedbackStatuses = [
  'SUBMITTED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'RESOLVED',
] as const;

export const feedbackCategorySchema = z.enum(feedbackCategories);
export const feedbackStatusSchema = z.enum(feedbackStatuses);

const feedbackReplySchema = z.object({
  id: z.string(),
  body: z.string(),
  authorId: z.string(),
  createdAt: z.iso.datetime(),
});

export const feedbackSchema = z.object({
  id: z.string(),
  category: feedbackCategorySchema,
  body: z.string(),
  isAnonymous: z.boolean(),
  status: feedbackStatusSchema,
  attachments: z.array(z.url()).max(3),
  userId: z.string().nullable().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const feedbackDetailSchema = feedbackSchema.extend({
  replies: z.array(feedbackReplySchema),
});

const feedbackPageSchema = z.object({
  items: z.array(feedbackSchema),
  nextCursor: z.string().nullish().transform((value) => value ?? undefined),
});

// Uploaded attachment URLs must be https and, when configured, served from the storage origin.
const STORAGE_ORIGIN = process.env.NEXT_PUBLIC_STORAGE_ORIGIN
  ? new URL(process.env.NEXT_PUBLIC_STORAGE_ORIGIN).origin
  : null;

const attachmentUrlSchema = z.url().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (!STORAGE_ORIGIN || url.origin === STORAGE_ORIGIN);
  } catch {
    return false;
  }
});

export const createFeedbackSchema = z.object({
  category: feedbackCategorySchema,
  body: z.string().trim().min(10).max(4000),
  isAnonymous: z.boolean().optional().default(false),
  attachments: z.array(attachmentUrlSchema).max(3).optional().default([]),
});

export const uploadResultSchema = z.object({
  url: z.url(),
  path: z.string().min(1),
});

export type Feedback = z.infer<typeof feedbackSchema>;
export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>;
export type FeedbackDetail = z.infer<typeof feedbackDetailSchema>;
export type FeedbackPage = z.infer<typeof feedbackPageSchema>;
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;

export function parseFeedback(payload: unknown): Feedback {
  return z.object({ data: feedbackSchema }).parse(payload).data;
}

export function parseFeedbackDetail(payload: unknown): FeedbackDetail {
  return z.object({ data: feedbackDetailSchema }).parse(payload).data;
}

export function parseFeedbackPage(payload: unknown): FeedbackPage {
  return z.object({ data: feedbackPageSchema }).parse(payload).data;
}

export function parseUploadResult(payload: unknown): z.infer<typeof uploadResultSchema> {
  return z.object({ data: uploadResultSchema }).parse(payload).data;
}

export function isFeedbackStatus(value: string | null): value is FeedbackStatus {
  return feedbackStatuses.some((status) => status === value);
}