/**
 * Log-safe form of an email: first character of the local part plus the
 * domain, e.g. "ahmed@example.com" -> "a***@example.com".
 */
export function maskEmail(email: string): string {
    const at = email.lastIndexOf('@');
    if (at <= 0) return '***';
    return `${email[0]}***${email.slice(at)}`;
}

/** Log-safe form of an opaque token: only its length and last 4 chars. */
export function maskToken(token: string): string {
    if (token.length <= 8) return `***(${token.length})`;
    return `***${token.slice(-4)}(${token.length})`;
}
