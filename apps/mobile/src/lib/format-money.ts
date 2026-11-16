import { piastersToDecimal, toPiasters } from "@/lib/decimal-money";
import { formatCurrency } from "@/lib/format-currency";

/** Significant digits a double holds exactly (15). Above that the amount is grouped as text, never rounded. */
const SAFE_DIGITS = 15;
const NON_DIGITS = /\D/g;
const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;

/** "12,500 EGP" style text of a decimal string; exact at any size (the number path is only used when lossless). */
export function formatMoney(value: string | number | null | undefined): string {
  const decimal = piastersToDecimal(toPiasters(value));
  if (decimal.replace(NON_DIGITS, "").length <= SAFE_DIGITS)
    return formatCurrency(Number(decimal));
  const negative = decimal.startsWith("-");
  const [whole, frac] = decimal.replace("-", "").split(".");
  const grouped = whole.replace(THOUSANDS, ",");
  return `${negative ? "-" : ""}EGP ${grouped}${frac === "00" ? "" : `.${frac}`}`;
}
