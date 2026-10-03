import { z } from 'zod';

export const announcementCategories = [
  'GENERAL',
  'PROMOTION',
  'EVENT',
  'MAINTENANCE',
  'NEWS',
] as const;

export type AnnouncementCategory = (typeof announcementCategories)[number];

const announcementSchema = z.object({
  id: z.string(),
  title: z.string(),
  titleAr: z.string(),
  body: z.string(),
  bodyAr: z.string(),
  category: z.enum(announcementCategories),
  pdfUrl: z.string().nullable().optional().transform((value) => value ?? null),
  publishedAt: z.string(),
  createdAt: z.string(),
});

// The backend exposes comment author ids only to the comment owner and admins; guests and other
// residents receive `user.name` alone. The UI renders only the name.
const commentSchema = z.object({
  id: z.string(),
  body: z.string(),
  userId: z.string().nullish(),
  user: z.object({
    id: z.string().nullish(),
    name: z.string(),
  }),
  createdAt: z.string(),
});

const announcementDetailSchema = z.object({
  data: announcementSchema.extend({
    comments: z.array(commentSchema),
  }),
});

const announcementPageSchema = z.object({
  data: z.object({
    items: z.array(announcementSchema),
    nextCursor: z.string().optional(),
  }),
});

export type Announcement = z.infer<typeof announcementSchema>;
export type AnnouncementComment = z.infer<typeof commentSchema>;
export type AnnouncementDetail = z.infer<typeof announcementDetailSchema>['data'];
export type AnnouncementPage = z.infer<typeof announcementPageSchema>['data'];

export function parseAnnouncementDetail(payload: unknown): AnnouncementDetail {
  return announcementDetailSchema.parse(payload).data;
}

export function parseAnnouncementPage(payload: unknown): AnnouncementPage {
  return announcementPageSchema.parse(payload).data;
}

export function isAnnouncementCategory(value: string | null): value is AnnouncementCategory {
  return announcementCategories.some((category) => category === value);
}