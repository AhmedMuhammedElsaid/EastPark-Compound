/**
 * Hermes has no Intl.PluralRules, and i18next then silently falls back to the
 * `_other` form for every count ("٢ مرشح" instead of "مرشحان"). This is a
 * minimal cardinal-only implementation for the app's two languages, installed
 * only when the runtime lacks the real thing.
 */

type Category = "zero" | "one" | "two" | "few" | "many" | "other";

const AR_CATEGORIES: Category[] = ["few", "many", "one", "two", "zero", "other"];
const EN_CATEGORIES: Category[] = ["one", "other"];

export function selectArabic(value: number): Category {
  if (!Number.isInteger(value))
    return "other";
  const n = Math.abs(value);
  if (n === 0)
    return "zero";
  if (n === 1)
    return "one";
  if (n === 2)
    return "two";
  const mod100 = n % 100;
  if (mod100 >= 3 && mod100 <= 10)
    return "few";
  if (mod100 >= 11)
    return "many";
  return "other";
}

export function selectEnglish(value: number): Category {
  return value === 1 ? "one" : "other";
}

export class SimplePluralRules {
  private readonly locale: string;
  private readonly isArabic: boolean;

  constructor(locale?: string | string[]) {
    const tag = (Array.isArray(locale) ? locale[0] : locale) ?? "en";
    this.locale = tag;
    this.isArabic = tag.toLowerCase().startsWith("ar");
  }

  select(value: number): Category {
    return this.isArabic ? selectArabic(value) : selectEnglish(value);
  }

  resolvedOptions() {
    return { locale: this.locale, type: "cardinal", pluralCategories: this.isArabic ? AR_CATEGORIES : EN_CATEGORIES };
  }

  static supportedLocalesOf(locales?: string | string[]) {
    return Array.isArray(locales) ? locales : locales ? [locales] : [];
  }
}

/** Installs the fallback when the JS engine has no Intl.PluralRules. */
export function installPluralRulesFallback() {
  const intl = (globalThis as { Intl?: Record<string, unknown> }).Intl;
  if (intl && typeof intl.PluralRules !== "function")
    intl.PluralRules = SimplePluralRules;
}
