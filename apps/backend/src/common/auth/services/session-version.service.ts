import {
    Injectable,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';

import { CacheService } from '../../cache/services/cache.service';

/** How long a version read from Redis is reused in this process. */
export const SESSION_VERSION_MEMO_TTL_MS = 5_000;
/** Memo size cap; when reached the memo is simply cleared. */
export const SESSION_VERSION_MEMO_MAX_ENTRIES = 10_000;

/**
 * Persistent per-user session version (no TTL, also for soft-deleted
 * accounts: they can be restored, and an expiring key would reset the version
 * below tokens minted later); bumped to revoke all sessions.
 */
export function sessionVersionKey(userId: string): string {
    return `session-version:${userId}`;
}

interface MemoEntry {
    version: number;
    expiresAt: number;
}

/**
 * Per-user session version shared by access tokens, refresh tokens and the
 * orders socket. A token whose `ver` is lower than the current version was
 * issued before a password reset or account deletion and is rejected.
 *
 * Redis is the source of truth. The in-process memo only bounds Upstash
 * command volume on the hot path (every authenticated request) to one GET per
 * user per 5 s. `bump()` overwrites the memo, so revocation is immediate on
 * the instance that performed it and lags at most 5 s on any other instance.
 *
 * Redis failures FAIL CLOSED with 503: login and refresh already hard-depend
 * on Redis, and serving a stale memo during an outage would let a revoked
 * token through. A stale memo entry is never used once it has expired.
 */
@Injectable()
export class SessionVersionService {
    private readonly memo = new Map<string, MemoEntry>();

    constructor(private readonly cache: CacheService) {}

    async getCurrent(userId: string): Promise<number> {
        const hit = this.memo.get(userId);
        if (hit && hit.expiresAt > Date.now()) return hit.version;

        let raw: number | string | null;
        try {
            raw = await this.cache.get<number | string>(
                sessionVersionKey(userId)
            );
        } catch {
            throw new ServiceUnavailableException(
                'auth.error.sessionStoreUnavailable'
            );
        }
        const parsed = Number(raw ?? 0);
        const version = Number.isFinite(parsed) ? parsed : 0;
        this.remember(userId, version);
        return version;
    }

    async bump(userId: string): Promise<number> {
        let version: number;
        try {
            version = await this.cache.incr(sessionVersionKey(userId));
        } catch {
            throw new ServiceUnavailableException(
                'auth.error.sessionStoreUnavailable'
            );
        }
        this.remember(userId, version);
        return version;
    }

    /**
     * `ver` absent = token minted before session versions existed = 0, the
     * same rule refresh() uses, so existing sessions survive until a real
     * bump. `<` rather than `!==`: a lost or flushed Redis key reads as 0 and
     * must not strand every signed-in user.
     */
    async assertCurrent(payload: {
        userId: string;
        ver?: number;
    }): Promise<void> {
        const current = await this.getCurrent(payload.userId);
        if ((payload.ver ?? 0) < current)
            throw new UnauthorizedException('auth.error.sessionRevoked');
    }

    private remember(userId: string, version: number): void {
        if (
            !this.memo.has(userId) &&
            this.memo.size >= SESSION_VERSION_MEMO_MAX_ENTRIES
        )
            this.memo.clear();
        this.memo.set(userId, {
            version,
            expiresAt: Date.now() + SESSION_VERSION_MEMO_TTL_MS,
        });
    }
}
