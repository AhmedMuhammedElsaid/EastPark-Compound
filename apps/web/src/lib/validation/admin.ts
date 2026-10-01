import { z } from 'zod';

export const announcementCategories = [
  'GENERAL',
  'PROMOTION',
  'EVENT',
  'MAINTENANCE',
  'NEWS',
] as const;

export const visibilityModes = [
  'SEALED_UNTIL_DEADLINE',
  'LIVE_COUNT',
  'ADMIN_CONTROLLED',
] as const;

const requiredText = z.string().trim().min(3).max(5_000);
const optionalText = z.string().trim().max(5_000).optional().or(z.literal(''));
const optionalUrl = z.string().trim().url().optional().or(z.literal(''));
const isoDate = z.string().datetime({ offset: true });
const futureIsoDate = isoDate.refine((value) => Date.parse(value) > Date.now());

export const announcementCreateSchema = z.object({
  title: requiredText.max(200),
  titleAr: requiredText.max(200),
  body: requiredText,
  bodyAr: requiredText,
  category: z.enum(announcementCategories).default('GENERAL'),
  pdfUrl: optionalUrl,
  publishedAt: isoDate.optional(),
});

export const pollCreateSchema = z.object({
  question: requiredText.max(500),
  questionAr: requiredText.max(500),
  expiresAt: futureIsoDate,
  options: z
    .array(
      z.object({
        label: requiredText.max(200),
        labelAr: requiredText.max(200),
      }),
    )
    .min(2)
    .max(12),
});

export const electionCreateSchema = z.object({
  title: requiredText.max(200),
  titleAr: requiredText.max(200),
  description: optionalText,
  descriptionAr: optionalText,
  expiresAt: futureIsoDate,
  visibilityMode: z.enum(visibilityModes).default('SEALED_UNTIL_DEADLINE'),
});

export const candidateCreateSchema = z.object({
  electionId: z.string().trim().min(1).max(200),
  name: requiredText.max(200),
  nameAr: requiredText.max(200),
  statement: optionalText,
  statementAr: optionalText,
  photoUrl: optionalUrl,
});

export type AnnouncementCreatePayload = z.infer<typeof announcementCreateSchema>;
export type PollCreatePayload = z.infer<typeof pollCreateSchema>;
export type ElectionCreatePayload = z.infer<typeof electionCreateSchema>;
export type CandidateCreatePayload = z.infer<typeof candidateCreateSchema>;