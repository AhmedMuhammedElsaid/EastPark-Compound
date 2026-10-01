import { z } from 'zod';

const safeDocumentUrlSchema = z
  .url()
  .refine((value) => {
    const url = new URL(value);
    const localDevelopmentUrl =
      url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    return !url.username && !url.password && (url.protocol === 'https:' || localDevelopmentUrl);
  }, 'Report URL must use HTTPS');

const reportSchema = z.object({
  id: z.string(),
  title: z.string(),
  titleAr: z.string(),
  pdfUrl: safeDocumentUrlSchema,
  publishedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

const reportDetailSchema = z.object({ data: reportSchema });

const reportPageSchema = z.object({
  data: z.object({
    items: z.array(reportSchema),
    nextCursor: z.string().nullish().transform((value) => value ?? undefined),
  }),
});

export type Report = z.infer<typeof reportSchema>;
export type ReportPage = z.infer<typeof reportPageSchema>['data'];

export function parseReport(payload: unknown): Report {
  return reportDetailSchema.parse(payload).data;
}

export function parseReportPage(payload: unknown): ReportPage {
  return reportPageSchema.parse(payload).data;
}