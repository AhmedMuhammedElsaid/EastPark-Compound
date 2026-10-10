import { z } from "zod";

const reviewSchema = z.object({
  id: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable().optional().transform((value) => value ?? null),
  // `id` is optional so a backend privacy pass that hides reviewer ids cannot break parsing.
  user: z.object({ id: z.string().nullish(), name: z.string() }),
  createdAt: z.string(),
});

const reviewPageSchema = z.object({
  items: z.array(reviewSchema),
  nextCursor: z.string().nullish().transform((value) => value ?? undefined),
  averageRating: z.number().min(1).max(5).nullish().transform((value) => value ?? null),
});

const reviewEnvelopeSchema = z.object({ data: reviewSchema });
const reviewPageEnvelopeSchema = z.object({ data: reviewPageSchema });

export const reviewInputSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().transform((value) => value || undefined),
});

export type Review = z.infer<typeof reviewSchema>;
export type ReviewPage = z.infer<typeof reviewPageSchema>;
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export function parseReview(payload: unknown): Review {
  return reviewEnvelopeSchema.parse(payload).data;
}

export function parseReviewPage(payload: unknown): ReviewPage {
  return reviewPageEnvelopeSchema.parse(payload).data;
}
/** The shop was deleted or never existed: review and save calls answer 404 for it. */
export class ShopGoneError extends Error {
  constructor() {
    super('shop_gone');
  }
}

/** Throws `ShopGoneError` for a 404 from a shop review/save BFF route; other failures are left to the caller. */
export function assertShopPresent(response: { status: number }): void {
  if (response.status === 404) throw new ShopGoneError();
}
