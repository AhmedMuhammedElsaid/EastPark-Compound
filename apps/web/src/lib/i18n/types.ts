import type { translations } from './translations';

/**
 * Recursively builds a union of dot-path keys for a nested string-leaf object,
 * e.g. { auth: { errors: { invalid_email: string } } } -> 'auth.errors.invalid_email'.
 */
export type DotPaths<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotPaths<T[K]>}`;
    }[keyof T & string];

export type TranslationShape = (typeof translations)['en'];

export type TranslationKey = DotPaths<TranslationShape>;

export type TranslationVars = Record<string, string | number>;
