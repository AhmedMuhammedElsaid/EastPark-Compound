/**
 * Admin "create a shop for a merchant": the form schema (client), the payload schemas the BFF
 * re-validates before forwarding to backend `POST /v1/shops` / `POST /v1/shops/:id/photos`, and the
 * merchant-picker query + lenient item schema (`GET /v1/admin/user/merchants`). Dependency-free
 * besides zod, so the BFF and the browser share one contract.
 *
 * Backend traps mirrored here (`ShopCreateDto`, `forbidNonWhitelisted: true`):
 * - unknown keys 400, so payloads are rebuilt from known fields only (never `isOpen`: the DB
 *   default `true` applies);
 * - `@IsOptional` only skips null/undefined, so empty optional strings are sent as `undefined`;
 * - `@IsPhoneNumber()` without a region needs international `+` format;
 * - every working-hours day that is sent needs `open`, `close` (HH:mm) and `closed`.
 */
import { z } from 'zod';

export const shopCategories = ['CAFE_AND_FOOD', 'GROCERY', 'BUTCHER', 'SERVICES', 'OTHER'] as const;
export type ShopCategory = (typeof shopCategories)[number];

export const weekDays = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const;
export type WeekDay = (typeof weekDays)[number];

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** E.164-shaped: `+`, country code, 8–15 digits in all. The backend runs the full libphonenumber check. */
const INTERNATIONAL_PHONE = /^\+[1-9]\d{7,14}$/;
/** An Egyptian mobile typed locally (`01xxxxxxxxx`). */
const LOCAL_EGYPT_MOBILE = /^01[0125]\d{8}$/;

export const NAME_MAX = 120;
export const DESCRIPTION_MAX = 1_000;
export const DELIVERY_MAX_MINUTES = 1_440;

/** Strips spaces/dashes/brackets, turns `00…` into `+…` and a local Egyptian mobile into `+20…`. */
export function normalizePhone(value: string): string {
  const compact = value.replace(/[\s\-().]/g, '');
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;
  if (LOCAL_EGYPT_MOBILE.test(compact)) return `+2${compact}`;
  return compact;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const optionalPhone = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() ? normalizePhone(value) : undefined))
  .refine((value) => value === undefined || INTERNATIONAL_PHONE.test(value));

const daySchema = z.object({
  open: z.string().regex(HH_MM),
  close: z.string().regex(HH_MM),
  closed: z.boolean(),
});

const workingHoursSchema = z.object(
  Object.fromEntries(weekDays.map((day) => [day, daySchema.optional()])) as Record<WeekDay, z.ZodOptional<typeof daySchema>>,
);

/** `POST /api/admin/shops` body → backend `POST /v1/shops` (`ShopCreateDto`). Unknown keys are stripped. */
export const shopCreateSchema = z.object({
  merchantId: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(NAME_MAX),
  nameAr: z.string().trim().min(1).max(NAME_MAX),
  description: optionalText(DESCRIPTION_MAX),
  descriptionAr: optionalText(DESCRIPTION_MAX),
  category: z.enum(shopCategories),
  phone: optionalPhone,
  whatsapp: optionalPhone,
  deliveryTime: z.number().int().min(1).max(DELIVERY_MAX_MINUTES).optional(),
  workingHours: workingHoursSchema.optional(),
});
export type ShopCreatePayload = z.infer<typeof shopCreateSchema>;

/** `POST /api/admin/shops/:id/photos` body → backend `ShopAddPhotoDto` (the cover photo is order 0). */
export const shopPhotoSchema = z.object({
  url: z.url({ protocol: /^https?$/ }).max(2_048),
});

export const shopIdSchema = z.string().trim().min(1).max(100);

/** `GET /api/admin/merchants` query → backend `GET /v1/admin/user/merchants`. */
export const merchantsQuerySchema = z.object({
  cursor: optionalText(200),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  q: optionalText(100),
});

export const adminMerchantItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().catch(''),
  email: z.string().catch(''),
  shop: z
    .object({ id: z.string().min(1), name: z.string().catch(''), nameAr: z.string().catch('') })
    .nullish()
    .transform((value) => value ?? null)
    .catch(null),
});
export type AdminMerchantItem = z.infer<typeof adminMerchantItemSchema>;

// ── Form (react-hook-form values: every input is a string or boolean) ────────────────────────────

const formDaySchema = z
  .object({ open: z.string(), close: z.string(), closed: z.boolean() })
  .refine((day) => day.closed || (HH_MM.test(day.open) && HH_MM.test(day.close)));

export const shopFormSchema = z.object({
  merchantId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(NAME_MAX),
  nameAr: z.string().trim().min(1).max(NAME_MAX),
  description: z.string().trim().max(DESCRIPTION_MAX),
  descriptionAr: z.string().trim().max(DESCRIPTION_MAX),
  category: z.enum(shopCategories),
  phone: z.string().refine((value) => !value.trim() || INTERNATIONAL_PHONE.test(normalizePhone(value))),
  whatsapp: z.string().refine((value) => !value.trim() || INTERNATIONAL_PHONE.test(normalizePhone(value))),
  deliveryTime: z
    .string()
    .trim()
    .refine((value) => !value || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= DELIVERY_MAX_MINUTES)),
  hoursEnabled: z.boolean(),
  hours: z.object(
    Object.fromEntries(weekDays.map((day) => [day, formDaySchema])) as Record<WeekDay, typeof formDaySchema>,
  ),
});
export type ShopFormValues = z.infer<typeof shopFormSchema>;

export const DEFAULT_DAY = { open: '09:00', close: '22:00', closed: false } as const;

export function emptyShopForm(merchantId = ''): ShopFormValues {
  return {
    merchantId,
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    category: 'CAFE_AND_FOOD',
    phone: '',
    whatsapp: '',
    deliveryTime: '',
    hoursEnabled: false,
    hours: Object.fromEntries(weekDays.map((day) => [day, { ...DEFAULT_DAY }])) as ShopFormValues['hours'],
  };
}

/**
 * Builds the backend payload from validated form values. A closed day keeps valid placeholder times
 * (the backend validates `open`/`close` even when `closed` is true); hours off → no `workingHours`.
 */
export function toShopCreatePayload(values: ShopFormValues): ShopCreatePayload {
  const blank = (value: string) => value.trim() || undefined;
  const workingHours = values.hoursEnabled
    ? (Object.fromEntries(
        weekDays.map((day) => {
          const { open, close, closed } = values.hours[day];
          return [
            day,
            {
              open: HH_MM.test(open) ? open : DEFAULT_DAY.open,
              close: HH_MM.test(close) ? close : DEFAULT_DAY.close,
              closed,
            },
          ];
        }),
      ) as ShopCreatePayload['workingHours'])
    : undefined;
  return {
    merchantId: values.merchantId.trim(),
    name: values.name.trim(),
    nameAr: values.nameAr.trim(),
    description: blank(values.description),
    descriptionAr: blank(values.descriptionAr),
    category: values.category,
    phone: values.phone.trim() ? normalizePhone(values.phone) : undefined,
    whatsapp: values.whatsapp.trim() ? normalizePhone(values.whatsapp) : undefined,
    deliveryTime: values.deliveryTime.trim() ? Number(values.deliveryTime.trim()) : undefined,
    workingHours,
  };
}
