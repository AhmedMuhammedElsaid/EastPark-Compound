import i18n from "@/lib/i18n";

function locale() {
  return i18n.language === "ar" ? "ar-EG" : "en-GB";
}

/** Rating with one decimal in the active locale ("4.0" / "٤٫٠") so it matches localized prices. */
export function formatRating(value: number): string {
  return value.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Whole number in the active locale (review counts, quantities). */
export function formatCount(value: number): string {
  return value.toLocaleString(locale(), { maximumFractionDigits: 0 });
}
