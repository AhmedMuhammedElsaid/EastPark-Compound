import {
    BadGatewayException,
    BadRequestException,
    Injectable,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

import {
    ENUM_FILE_STORE,
    FILE_MAX_IMAGE_SIZE,
    FINANCE_MAX_PDF_SIZE,
    FINANCE_STORE_FOLDERS,
} from '../enums/files.enum';
import { detectImageType, detectPdf } from '../file-signature';

/**
 * Lifetime of a finance signed URL. The live privacy policy promises staff
 * links "that expire after 60 seconds": do not change without the policy.
 */
export const FINANCE_SIGNED_URL_TTL_SEC = 60;

/** Unattached uploads under `staging/` older than this are swept (plan 5.3). */
export const FINANCE_STAGING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** How long a confirmed-private bucket check is trusted (review L3). */
export const BUCKET_RECHECK_MS = 10 * 60 * 1000;

const PATH_PATTERN = /^[a-z]+\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_.-]+)+$/;

/**
 * A finance object path as stored on a row (`receipts/2026/R-2026-000123/x.jpg`
 * or `staging/<userId>/x.jpg`): a known finance folder, safe characters, no
 * `..` segment. Anything else is treated as unknown.
 */
export function isFinanceAttachmentPath(value: unknown): value is string {
    if (typeof value !== 'string' || value.length > 300) return false;
    if (!PATH_PATTERN.test(value)) return false;
    const segments = value.split('/');
    if (segments.some(s => s === '' || s === '.' || s === '..')) return false;
    return FINANCE_STORE_FOLDERS.includes(segments[0] ?? '');
}

/** `staging/<ownerId>/...`: an upload of `ownerId` not yet attached to a row. */
export function isOwnStagingPath(path: string, ownerId: string): boolean {
    return (
        isFinanceAttachmentPath(path) &&
        path.startsWith(`${ENUM_FILE_STORE.FINANCE_STAGING}/${ownerId}/`)
    );
}

export interface SignedFileUrl {
    url: string;
    expiresAt: Date;
}

export interface StagedObject {
    path: string;
    createdAt: Date;
}

/**
 * Private finance storage (accounting plan 5.2, 5.3): payment slips and
 * cheque photos live ONLY in the private bucket `supabase.financeBucket`
 * (default `eastpark-finance`). This service never builds a public URL; reads
 * go through `createSignedUrl` with a fixed 60 s lifetime. The public
 * `FileService` is untouched.
 *
 * Boot check (mirrors the public bucket's `getOrThrow`): the bucket name must
 * be configured and must differ from the public uploads bucket, otherwise the
 * app refuses to start. Before the first write or signed URL the bucket is
 * also checked to exist and to be private; a missing or public bucket fails
 * the request with 502 `storage_unavailable` (never a silent public upload).
 * Object paths are never logged.
 */
@Injectable()
export class PrivateFileService {
    private readonly logger = new Logger(PrivateFileService.name);
    private readonly supabase: SupabaseClient;
    private readonly bucket: string;
    /** When the bucket was last confirmed private (0 = never). */
    private verifiedAt = 0;

    constructor(config: ConfigService) {
        const bucket = config
            .getOrThrow<string>('supabase.financeBucket')
            .trim();
        const publicBucket = config
            .getOrThrow<string>('supabase.bucket')
            .trim();
        if (!bucket)
            throw new Error('SUPABASE_FINANCE_BUCKET must not be empty');
        if (bucket.toLowerCase() === publicBucket.toLowerCase())
            throw new Error(
                'SUPABASE_FINANCE_BUCKET must be a separate private bucket, not the public uploads bucket'
            );
        this.bucket = bucket;
        this.supabase = createClient(
            config.getOrThrow<string>('supabase.url'),
            config.getOrThrow<string>('supabase.serviceKey')
        );
    }

    get bucketName(): string {
        return this.bucket;
    }

    /**
     * Stores a slip/cheque image (JPEG/PNG/WEBP <= 5 MB) or PDF (<= 10 MB)
     * under `staging/<ownerId>/`, type sniffed from the bytes (the client
     * filename and MIME are discarded). Returns the object path only.
     */
    async uploadStaging(
        buffer: Buffer,
        ownerId: string
    ): Promise<{ path: string }> {
        const image = detectImageType(buffer);
        const detected = image ?? detectPdf(buffer);
        if (!detected)
            throw new BadRequestException('finance.error.attachmentType');
        const max = image ? FILE_MAX_IMAGE_SIZE : FINANCE_MAX_PDF_SIZE;
        if (buffer.length > max)
            throw new BadRequestException('finance.error.attachmentTooLarge');

        await this.assertPrivateBucket();
        const path = `${ENUM_FILE_STORE.FINANCE_STAGING}/${ownerId}/${Date.now()}-${randomUUID()}.${detected.ext}`;
        const { error } = await this.supabase.storage
            .from(this.bucket)
            .upload(path, buffer, {
                contentType: detected.mime,
                upsert: false,
            });
        if (error) {
            this.logger.error(
                `Private upload to bucket "${this.bucket}" failed: ${error.message}`
            );
            throw new BadGatewayException('storage_unavailable');
        }
        return { path };
    }

    /** A signed URL valid for exactly `FINANCE_SIGNED_URL_TTL_SEC` seconds. */
    async createSignedUrl(path: string): Promise<SignedFileUrl> {
        if (!isFinanceAttachmentPath(path))
            throw new BadRequestException('finance.error.attachmentNotFound');
        await this.assertPrivateBucket();
        const issuedAt = Date.now();
        const { data, error } = await this.supabase.storage
            .from(this.bucket)
            .createSignedUrl(path, FINANCE_SIGNED_URL_TTL_SEC);
        if (error || !data?.signedUrl) {
            this.logger.error(
                `Signed URL from bucket "${this.bucket}" failed: ${error?.message ?? 'no url'}`
            );
            throw new BadGatewayException('storage_unavailable');
        }
        return {
            url: data.signedUrl,
            expiresAt: new Date(issuedAt + FINANCE_SIGNED_URL_TTL_SEC * 1000),
        };
    }

    /**
     * True when `path` names an object in the private bucket (listing its
     * folder filtered by the file name). A storage error counts as "missing":
     * the caller refuses to attach a file it cannot confirm.
     */
    async exists(path: string): Promise<boolean> {
        if (!isFinanceAttachmentPath(path)) return false;
        const cut = path.lastIndexOf('/');
        const folder = path.slice(0, cut);
        const name = path.slice(cut + 1);
        const { data, error } = await this.supabase.storage
            .from(this.bucket)
            .list(folder, { limit: 100, search: name });
        if (error) {
            this.logger.warn(`Private exists check failed: ${error.message}`);
            return false;
        }
        return (data ?? []).some(f => f.name === name && f.id !== null);
    }

    /** Server-side copy inside the private bucket (true on success). */
    async copy(from: string, to: string): Promise<boolean> {
        const { error } = await this.supabase.storage
            .from(this.bucket)
            .copy(from, to);
        if (error) {
            this.logger.warn(`Private copy failed: ${error.message}`);
            return false;
        }
        return true;
    }

    /** Best-effort delete (true on success). */
    async remove(paths: readonly string[]): Promise<boolean> {
        if (paths.length === 0) return true;
        const { error } = await this.supabase.storage
            .from(this.bucket)
            .remove([...paths]);
        if (error) {
            this.logger.warn(
                `Private delete of ${paths.length} object(s) failed: ${error.message}`
            );
            return false;
        }
        return true;
    }

    /**
     * Objects under `staging/<userId>/` created before `before` (one folder
     * level per uploader, as `uploadStaging` writes them).
     */
    async listStagingBefore(before: Date): Promise<StagedObject[]> {
        const root = ENUM_FILE_STORE.FINANCE_STAGING;
        const folders = await this.list(root);
        const out: StagedObject[] = [];
        for (const folder of folders) {
            if (folder.id !== null) continue; // a file at the root: not ours
            const files = await this.list(`${root}/${folder.name}`);
            for (const file of files) {
                if (file.id === null || !file.created_at) continue;
                const createdAt = new Date(file.created_at);
                if (createdAt.getTime() < before.getTime())
                    out.push({
                        path: `${root}/${folder.name}/${file.name}`,
                        createdAt,
                    });
            }
        }
        return out;
    }

    private async list(
        prefix: string
    ): Promise<
        { name: string; id: string | null; created_at?: string | null }[]
    > {
        const out: {
            name: string;
            id: string | null;
            created_at?: string | null;
        }[] = [];
        const pageSize = 1000;
        for (let offset = 0; ; offset += pageSize) {
            const { data, error } = await this.supabase.storage
                .from(this.bucket)
                .list(prefix, { limit: pageSize, offset });
            if (error) {
                this.logger.warn(`Private list failed: ${error.message}`);
                return out;
            }
            out.push(...(data ?? []));
            if (!data || data.length < pageSize) return out;
        }
    }

    /**
     * The bucket must exist and be PRIVATE before anything is written or
     * signed. A success is trusted for `BUCKET_RECHECK_MS` (review L3: a
     * bucket switched to public later is caught within 10 minutes); a failure
     * is re-checked on the next call, so fixing the bucket needs no restart.
     */
    private async assertPrivateBucket(): Promise<void> {
        if (
            this.verifiedAt > 0 &&
            Date.now() - this.verifiedAt < BUCKET_RECHECK_MS
        )
            return;
        this.verifiedAt = 0;
        const { data, error } = await this.supabase.storage.getBucket(
            this.bucket
        );
        if (error || !data) {
            this.logger.error(
                `Private bucket "${this.bucket}" is not available: ${error?.message ?? 'missing'}`
            );
            throw new BadGatewayException('storage_unavailable');
        }
        if (data.public) {
            this.logger.error(
                `Bucket "${this.bucket}" is PUBLIC; finance files are refused until it is made private`
            );
            throw new BadGatewayException('storage_unavailable');
        }
        this.verifiedAt = Date.now();
    }
}
