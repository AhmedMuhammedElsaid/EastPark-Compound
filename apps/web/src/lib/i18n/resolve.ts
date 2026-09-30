import type { TranslationKey, TranslationVars } from './types';

/**
 * Resolves a dot-path key (e.g. "auth.errors.invalid_email") against a nested
 * translation object. Returns undefined if any segment along the path is
 * missing, so the caller can fall back to the raw key.
 */
function resolvePath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source);
}

/**
 * Interpolates `{{var}}` placeholders in a resolved string with values from `vars`.
 */
function interpolate(value: string, vars?: TranslationVars): string {
  if (!vars) return value;
  return value.replace(/\{\{\s*([\w]+)\s*\}\}/g, (match, name: string) => {
    const replacement = vars[name];
    return replacement === undefined ? match : String(replacement);
  });
}

/**
 * Resolves `key` against `dictionary` and interpolates `vars`. Falls back to
 * returning the key itself (as visible, debuggable output) if the path does
 * not resolve to a string.
 */
export function translate(
  dictionary: unknown,
  key: TranslationKey | string,
  vars?: TranslationVars,
): string {
  const resolved = resolvePath(dictionary, key);
  if (typeof resolved !== 'string') {
    return key;
  }
  return interpolate(resolved, vars);
}
