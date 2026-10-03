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
/** Header the Vercel BFF uses to pass the browser's IP (single address). */
export const BFF_CLIENT_IP_HEADER = 'x-eastpark-client-ip';

/**
 * Client-IP headers set by Cloudflare, which sits in front of Render. Cloudflare
 * always overwrites `CF-Connecting-IP`, so it comes first; `True-Client-IP` is
 * only a fallback. Both are forgeable wherever Cloudflare is NOT in front
 * (local dev, the Fly rollback), which is an accepted trade-off.
 */
const EDGE_CLIENT_IP_HEADERS = ['cf-connecting-ip', 'true-client-ip'] as const;

function firstHeaderValue(value: unknown): string | undefined {
    const raw = Array.isArray(value) ? value[0] : value;
    return typeof raw === 'string' ? raw : undefined;
}

/** The header value as a single valid IPv4/IPv6 address, else undefined. */
function validIp(value: unknown): string | undefined {
    const candidate = firstHeaderValue(value)?.trim();
    return candidate && isIP(candidate) !== 0 ? candidate : undefined;
}

/** Constant-time comparison that does not leak the secret's length. */
function secretMatches(provided: string, expected: string): boolean {
    const a = createHash('sha256').update(provided).digest();
    const b = createHash('sha256').update(expected).digest();
    return timingSafeEqual(a, b);
}

/**
 * Resolve the client IP used as the throttling key. Precedence:
 *
 * 1. BFF requests (`X-EastPark-Internal` matches `BFF_INTERNAL_SECRET`,
 *    constant-time): `X-EastPark-Client-IP`, then the left-most
 *    `X-Forwarded-For` entry as a legacy fallback. On these requests the
 *    Cloudflare headers carry Vercel's egress IP, so they must not win.
 * 2. `CF-Connecting-IP`, then `True-Client-IP` (Cloudflare edge, in front of
 *    Render).
 * 3. `req.ip`, then the socket address.
 *
 * Every candidate must be a valid IPv4/IPv6 address. Client-supplied
 * `X-Forwarded-For` is never read for non-BFF requests: on Render `req.ip`
 * (Fastify `trustProxy: 1`) is the right-most XFF hop, i.e. the Cloudflare
 * edge, which varies per request and is shared by unrelated users.
 */
export function resolveClientIp(
    req: Record<string, any>,
    internalSecret?: string
): string {
    const headers: Record<string, unknown> = req?.headers ?? {};
    if (internalSecret) {
        const provided = firstHeaderValue(headers[BFF_INTERNAL_HEADER]);
        if (provided && secretMatches(provided, internalSecret)) {
            const dedicated = validIp(headers[BFF_CLIENT_IP_HEADER]);
            if (dedicated) return dedicated;
            const forwarded = firstHeaderValue(headers['x-forwarded-for']);
            const leftMost = validIp(forwarded?.split(',')[0]);
            if (leftMost) return leftMost;
        }
    }
    for (const name of EDGE_CLIENT_IP_HEADERS) {
        const edgeIp = validIp(headers[name]);
        if (edgeIp) return edgeIp;
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
