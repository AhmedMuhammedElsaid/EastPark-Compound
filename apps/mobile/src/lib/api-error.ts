/** Helpers for classifying axios-style errors without importing axios. */

export function getErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null | undefined)?.response?.status;
}

/** True when the request produced no HTTP response (timeout, offline, DNS). */
export function isNoResponseError(error: unknown): boolean {
  return getErrorStatus(error) === undefined;
}

/**
 * Pick a translation key for a failed mutation from a status -> key map,
 * falling back to `fallbackKey`. Network errors use the `network` entry.
 */
export function pickErrorKey(
  error: unknown,
  map: Partial<Record<number | "network", string>>,
  fallbackKey: string,
): string {
  const status = getErrorStatus(error);
  if (status === undefined)
    return map.network ?? fallbackKey;
  return map[status] ?? fallbackKey;
}
