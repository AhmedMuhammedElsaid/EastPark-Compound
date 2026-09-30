import { z } from "zod";

export const shopCategories = [
  "CAFE_AND_FOOD",
  "GROCERY",
  "BUTCHER",
  "SERVICES",
  "OTHER",
] as const;

export type ShopCategory = (typeof shopCategories)[number];

const shopPhotoSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  order: z.number(),
  isPrimary: z.boolean(),
});

const workingHoursDaySchema = z.object({
  open: z.string(),
  close: z.string(),
  closed: z.boolean(),
});

const workingHoursSchema = z.record(z.string(), workingHoursDaySchema);

const shopSchema = z.object({
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
  category: z.enum(shopCategories),
  photos: z.array(shopPhotoSchema),
  workingHours: workingHoursSchema
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  isOpen: z.boolean(),
  phone: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  whatsapp: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  deliveryTime: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  reviewCount: z.number().int().nonnegative(),
  averageRating: z
    .number()
    .min(1)
    .max(5)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

const shopDetailSchema = z.object({ data: shopSchema });

const shopPageSchema = z.object({
  data: z.object({
    items: z.array(shopSchema),
    nextCursor: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
  }),
});

export type Shop = z.infer<typeof shopSchema>;
export type WorkingHoursDay = z.infer<typeof workingHoursDaySchema>;
export type ShopPage = z.infer<typeof shopPageSchema>["data"];

export function parseShopDetail(payload: unknown): Shop {
  return shopDetailSchema.parse(payload).data;
}

export function parseShopPage(payload: unknown): ShopPage {
  return shopPageSchema.parse(payload).data;
}

export function isShopCategory(
  value: string | null | undefined,
): value is ShopCategory {
  return shopCategories.some((category) => category === value);
}
