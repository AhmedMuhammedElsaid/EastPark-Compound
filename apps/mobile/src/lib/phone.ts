/**
 * The backend validates shop phone/WhatsApp with @IsPhoneNumber() and no
 * region, so only international format (+20...) is accepted.
 */
const INTERNATIONAL_PHONE = /^\+\d{8,15}$/;
const SEPARATORS = /[\s\-.()]/g;
const EGYPT_LOCAL = /^01\d{9}$/;

/** Strips spaces, dashes, dots and parentheses; keeps a leading "+". */
function compact(value: string): string {
  return value.trim().replace(SEPARATORS, "");
}

/**
 * Normalises what a merchant typed to international format. Egyptian local
 * numbers (01XXXXXXXXX) and 0020/20-prefixed forms become +20XXXXXXXXXX.
 * Anything else is returned compacted, unchanged otherwise.
 */
export function normalizePhone(value: string | undefined | null): string {
  if (!value)
    return "";
  let v = compact(value);
  if (v.startsWith("00"))
    v = `+${v.slice(2)}`;
  if (EGYPT_LOCAL.test(v))
    return `+2${v}`;
  return v;
}

/** An empty value is valid (the field is optional). */
export function isValidPhone(value: string | undefined | null): boolean {
  const v = normalizePhone(value);
  return v === "" || INTERNATIONAL_PHONE.test(v);
}
