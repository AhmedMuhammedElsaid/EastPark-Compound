import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
    InjectThrottlerOptions,
    InjectThrottlerStorage,
    ThrottlerGuard,
    ThrottlerModuleOptions,
    ThrottlerStorage,
} from '@nestjs/throttler';

/** Header the Vercel BFF uses to prove it is the BFF. */
export const BFF_INTERNAL_HEADER = 'x-eastpark-internal';

function firstHeaderValue(value: unknown): string | undefined {
    const raw = Array.isArray(value) ? value[0] : value;
    return typeof raw === 'string' ? raw : undefined;
}

/** Constant-time comparison that does not leak the secret's length. */
function secretMatches(provided: string, expected: string): boolean {
    const a = createHash('sha256').update(provided).digest();
    const b = createHash('sha256').update(expected).digest();
    return timingSafeEqual(a, b);
}

/**
 * Resolve the client IP used as the throttling key.
 *
 * - A request carrying `X-EastPark-Internal: <BFF_INTERNAL_SECRET>` comes from
 *   our own Vercel BFF, which puts the browser's IP as the left-most
 *   `X-Forwarded-For` entry (Render appends its own hop after it). That entry
 *   is used when it is a valid IPv4/IPv6 address.
 * - Every other request is keyed on `req.ip`: with Fastify `trustProxy: 1`
 *   that is the TCP peer as seen by Render's proxy, which a direct caller
 *   cannot forge. Client-supplied `X-Forwarded-For` is never read for them.
 */
export function resolveClientIp(
    req: Record<string, any>,
    internalSecret?: string
): string {
    if (internalSecret) {
        const provided = firstHeaderValue(req?.headers?.[BFF_INTERNAL_HEADER]);
        if (provided && secretMatches(provided, internalSecret)) {
            const forwarded = firstHeaderValue(
                req?.headers?.['x-forwarded-for']
            );
            const candidate = forwarded?.split(',')[0]?.trim();
            if (candidate && isIP(candidate) !== 0) return candidate;
        }
    }
    if (typeof req?.ip === 'string' && req.ip) return req.ip;
    const socketIp: unknown =
        req?.socket?.remoteAddress ?? req?.raw?.socket?.remoteAddress;
    return typeof socketIp === 'string' && socketIp ? socketIp : 'unknown';
}

/** Throttler keyed per real client IP (see `resolveClientIp`). */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
    private readonly internalSecret?: string;

    constructor(
        @InjectThrottlerOptions() options: ThrottlerModuleOptions,
        @InjectThrottlerStorage() storageService: ThrottlerStorage,
        reflector: Reflector,
        config: ConfigService
    ) {
        super(options, storageService, reflector);
        this.internalSecret = config.get<string>('app.bffInternalSecret');
    }

    protected getTracker(req: Record<string, any>): Promise<string> {
        return Promise.resolve(resolveClientIp(req, this.internalSecret));
    }
}
