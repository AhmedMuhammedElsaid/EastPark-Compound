import { z } from 'zod';

export const orderStatuses = [
  'PLACED',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'ON_THE_WAY',
  'DELIVERED',
  'CANCELLED',
] as const;

export const orderStatusSchema = z.enum(orderStatuses);

const nullableText = z.string().nullable().optional().default(null);

export const merchantShopSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameAr: z.string(),
  description: nullableText,
  descriptionAr: nullableText,
  isOpen: z.boolean(),
  phone: nullableText,
  whatsapp: nullableText,
});

export const merchantProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameAr: z.string(),
  description: nullableText,
  descriptionAr: nullableText,
  price: z.number().nonnegative(),
  imageUrl: nullableText,
  isAvailable: z.boolean(),
});

export const merchantOrderItemSchema = z.object({
  id: z.string(),
  productNameSnapshot: z.string(),
  productNameArSnapshot: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});

export const merchantOrderSchema = z.object({
  id: z.string(),
  status: orderStatusSchema,
  totalAmount: z.number().nonnegative(),
  notes: nullableText,
  deliveryUnit: z.string(),
  paymentMethod: z.enum(['CASH', 'PAYMOB']),
  isPaid: z.boolean(),
  items: z.array(merchantOrderItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const productPageSchema = z.object({
  items: z.array(merchantProductSchema),
  nextCursor: z.string().nullish(),
});

export const orderPageSchema = z.object({
  items: z.array(merchantOrderSchema),
  nextCursor: z.string().nullish(),
});

export const productInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  descriptionAr: z.string().trim().max(1000).optional(),
  price: z.number().nonnegative().max(1_000_000),
  imageUrl: z.union([z.url(), z.literal('').transform(() => undefined)]).optional(),
  isAvailable: z.boolean().optional(),
});

export const productUpdateSchema = productInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required',
);

export const shopUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  nameAr: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  descriptionAr: z.string().trim().max(1000).optional(),
  phone: z.union([z.string().trim().min(1).max(30), z.literal('').transform(() => undefined)]).optional(),
  whatsapp: z.union([z.string().trim().min(1).max(30), z.literal('').transform(() => undefined)]).optional(),
  isOpen: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export type MerchantShop = z.infer<typeof merchantShopSchema>;
export type MerchantProduct = z.infer<typeof merchantProductSchema>;
export type MerchantOrder = z.infer<typeof merchantOrderSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
