import type { AuthUser } from "@/store/slices/auth-slice";
import { z } from "zod";

import { getErrorCode, getErrorStatus } from "./api-error";
import { isValidPhone, normalizePhone } from "./phone";
import { UNIT_NOT_OWNED_CODE } from "./units";

/**
 * Edit-profile form. `PUT /user` (UserUpdateDto) accepts name (2-100, trimmed),
 * phone (@IsPhoneNumber, international) or null, unitNumber (primary flat,
 * chosen on My flats) and avatarUrl (an uploaded file) or null. Messages are
 * translation keys.
 */
export const profileFormSchema = z.object({
  name: z.string().trim().min(2, "validation.min_2").max(100, "validation.max_100"),
  phone: z.string().refine(isValidPhone, "validation.invalid_phone"),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export type ProfileSource = Pick<AuthUser, "name" | "phone"> | null | undefined;

export function profileFormDefaults(user: ProfileSource): ProfileFormValues {
  return { name: user?.name ?? "", phone: user?.phone ?? "" };
}

export type ProfileUpdate = { name: string; phone: string | null; avatarUrl?: string | null };

/**
 * The `PUT /user` body. The phone goes out in international format (+20...) or
 * as null when cleared. `avatarUrl` is sent only when the photo changed
 * (a new upload URL, or null to remove it).
 */
export function toProfileUpdate(values: ProfileFormValues, avatarUrl?: string | null): ProfileUpdate {
  const phone = normalizePhone(values.phone);
  const body: ProfileUpdate = { name: values.name.trim(), phone: phone || null };
  if (avatarUrl !== undefined)
    body.avatarUrl = avatarUrl;
  return body;
}

/** Toast copy for a failed `PUT /user` (profile details or primary flat). */
export function profileSaveErrorKey(error: unknown): string {
  const status = getErrorStatus(error);
  if (status === undefined)
    return "errors.unreachable";
  if (status === 429)
    return "errors.rate_limited";
  if (status === 400 && getErrorCode(error) === UNIT_NOT_OWNED_CODE)
    return "profile.unit_not_owned";
  return "profile.save_error";
}
