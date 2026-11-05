import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FINANCE_STORE_FOLDERS } from './enums/files.enum';

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
        parsed.pathname.length > prefix.pathname.length &&
        !isFinanceObjectPath(parsed.pathname.slice(prefix.pathname.length))
    );
}

/**
 * True when an object path (relative to a bucket) lies in a finance folder
 * (`staging/`, `receipts/`, ...). Finance files live only in the private
 * bucket; refusing these folders here as well means a finance path can never
 * pass as a public image URL, even if one were ever copied into the public
 * bucket by mistake.
 */
export function isFinanceObjectPath(objectPath: string): boolean {
    const first = objectPath.split('/')[0] ?? '';
    let segment: string;
    try {
        segment = decodeURIComponent(first).trim().toLowerCase();
    } catch {
        return true;
    }
    return FINANCE_STORE_FOLDERS.includes(segment);
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
