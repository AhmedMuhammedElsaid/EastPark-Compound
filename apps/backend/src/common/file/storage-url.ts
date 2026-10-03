import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Public-object URL prefix of our upload bucket, exactly as supabase-js
 * `getPublicUrl` builds it: `<SUPABASE_URL>/storage/v1/object/public/<bucket>/`.
 */
export function storagePublicPrefix(supabaseUrl: string, bucket: string): URL {
    const base = supabaseUrl.endsWith('/') ? supabaseUrl : `${supabaseUrl}/`;
    return new URL(
        `storage/v1/object/public/${encodeURIComponent(bucket)}/`,
        base
    );
}

/**
 * True when `value` points at an object inside our public bucket: same scheme,
 * host and port as the configured storage, no credentials, and a path under
 * the bucket prefix after URL normalisation (so `..` and `%2e%2e` cannot
 * escape it).
 */
export function isStoragePublicUrl(
    value: unknown,
    supabaseUrl: string,
    bucket: string
): boolean {
    if (typeof value !== 'string' || value.includes('\\')) return false;

    let parsed: URL;
    let prefix: URL;
    try {
        parsed = new URL(value);
        prefix = storagePublicPrefix(supabaseUrl, bucket);
    } catch {
        return false;
    }

    return (
        parsed.origin === prefix.origin &&
        parsed.username === '' &&
        parsed.password === '' &&
        parsed.pathname.startsWith(prefix.pathname) &&
        parsed.pathname.length > prefix.pathname.length
    );
}

/**
 * Write-side guard for user-supplied image URLs (avatar, feedback
 * attachments): they must be files uploaded through `/uploads`, never an
 * arbitrary third-party URL. Stored values are not re-validated on read.
 */
export function assertStoragePublicUrls(
    config: ConfigService,
    urls: readonly unknown[],
    errorKey: string
): void {
    const supabaseUrl = config.getOrThrow<string>('supabase.url');
    const bucket = config.getOrThrow<string>('supabase.bucket');
    for (const url of urls) {
        if (!isStoragePublicUrl(url, supabaseUrl, bucket)) {
            throw new BadRequestException(errorKey);
        }
    }
}
