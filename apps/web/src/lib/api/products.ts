import { z } from "zod";

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameAr: z.string(),
  description: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  descriptionAr: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  price: z.number().nonnegative(),
  imageUrl: z
    .string()
    .url()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  isAvailable: z.boolean(),
  shopId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const productPageSchema = z.object({
  data: z.object({
    items: z.array(productSchema),
    nextCursor: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
  }),
});

export type Product = z.infer<typeof productSchema>;
export type ProductPage = z.infer<typeof productPageSchema>["data"];

export function parseProductPage(payload: unknown): ProductPage {
  return productPageSchema.parse(payload).data;
}