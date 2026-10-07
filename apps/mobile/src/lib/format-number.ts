/** Formats a count with locale digits: Arabic-Indic for Arabic, Latin otherwise. */
export function formatNumber(value: number, language: string): string {
  return value.toLocaleString(language === "ar" ? "ar-EG" : "en-US");
}
