import i18n from "@/lib/i18n";

export function formatCurrency(amount: number, currencyCode = "EGP"): string {
  const locale = i18n.language === "ar" ? "ar-EG" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}
