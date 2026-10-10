/** Mirrors the backend product price rule: 0.01 to 100,000 EGP, at most two decimals. */
export const PRODUCT_MIN_PRICE = 0.01;
export const PRODUCT_MAX_PRICE = 100_000;

export type ProductPriceProblem = 'required' | 'min' | 'max' | 'decimals';

/** Returns the first problem with a raw price input, or null when it is valid. */
export function productPriceProblem(raw: string): ProductPriceProblem | null {
  const text = raw.trim();
  if (text === '') return 'required';
  const value = Number(text);
  if (!Number.isFinite(value)) return 'required';
  if (value < PRODUCT_MIN_PRICE) return 'min';
  if (value > PRODUCT_MAX_PRICE) return 'max';
  // Decimal places are read from the text: 0.1 + 0.2 style float noise cannot hide a third place.
  const fraction = text.includes('.') ? (text.split('.')[1] ?? '') : '';
  if (/e/i.test(text) ? Math.round(value * 100) / 100 !== value : fraction.replace(/0+$/, '').length > 2) return 'decimals';
  return null;
}
