import { z } from "zod";

import { isValidBuilding, isValidFlat, isValidFloorForBuilding } from "@/lib/compound";
import { foldDigits } from "@/lib/listings";

/** Messages are i18n keys, resolved with t() at render time (same as the other mobile forms). */

// Matches the backend regex; separators are stripped before matching, like the backend does.
const SEPARATORS = /[\s()-]/g;
const NATIONAL_ID = /^\d{14}$/;
const PHONE_PATTERN = /^(?:\+?20|0)1[0125]\d{8}$/;

export const MARITAL_STATUSES = ["MARRIED", "SINGLE", "DIVORCED"] as const;

export const registerUnitSchema = z
  .object({
    name: z.string().trim().min(2, "register.errors.name_too_short").max(100),
    email: z.string().trim().min(1, "register.errors.email_required").email("register.errors.invalid_email"),
    phone: z
      .string()
      .trim()
      .min(1, "register.errors.phone_required")
      .refine(v => PHONE_PATTERN.test(foldDigits(v).replace(SEPARATORS, "")), { message: "register.errors.invalid_phone" }),
    building: z
      .string()
      .min(1, "register.errors.building_required")
      .refine(v => isValidBuilding(v), { message: "register.errors.invalid_building" }),
    floor: z.string().min(1, "register.errors.floor_required"),
    flatNumber: z
      .string()
      .min(1, "register.errors.flat_required")
      .refine(isValidFlat, { message: "register.errors.invalid_flat" }),
    parking: z.string().trim().max(60, "register.errors.parking_too_long").optional(),
    jobTitle: z.string().trim().max(100, "register.errors.job_too_long").optional(),
    maritalStatus: z.union([z.enum(MARITAL_STATUSES), z.literal("")]).optional(),
    nationalId: z
      .string()
      .trim()
      .refine(v => v === "" || NATIONAL_ID.test(foldDigits(v)), { message: "register.errors.invalid_national_id" })
      .optional(),
    passportNumber: z.string().trim().max(30, "register.errors.passport_too_long").optional(),
  })
  .superRefine((values, ctx) => {
    // Floor validity depends on the building's phase, so it can only be checked with both known.
    if (values.building && values.floor && !isValidFloorForBuilding(values.floor, values.building))
      ctx.addIssue({ code: "custom", path: ["floor"], message: "register.errors.invalid_floor" });
  });

export type RegisterUnitValues = z.infer<typeof registerUnitSchema>;

/** The request body: blank optional fields are omitted so nothing is overwritten with "". */
export function toLeadPayload(values: RegisterUnitValues) {
  const parking = values.parking?.trim();
  const jobTitle = values.jobTitle?.trim();
  const nationalId = values.nationalId ? foldDigits(values.nationalId.trim()) : undefined;
  const passportNumber = values.passportNumber?.trim();
  return {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    phone: foldDigits(values.phone.trim()),
    building: values.building,
    floor: values.floor,
    flatNumber: values.flatNumber,
    ...(parking ? { parking } : {}),
    ...(jobTitle ? { jobTitle } : {}),
    ...(values.maritalStatus ? { maritalStatus: values.maritalStatus } : {}),
    ...(nationalId ? { nationalId } : {}),
    ...(passportNumber ? { passportNumber } : {}),
  };
}
