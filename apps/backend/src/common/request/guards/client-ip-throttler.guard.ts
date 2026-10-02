import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Resolve the originating client IP of a request that reached us through
 * proxies (Render's edge, and the Vercel BFF which forwards the browser IP).
 * The left-most `X-Forwarded-For` entry is the original client; we fall back
 * to Fastify's `req.ip` (which, with `trustProxy: true`, is that same value)
 * and finally the socket address.
 *
 * Caveat: callers that reach the API directly can put any value in the
 * left-most slot, so this key is a per-client bucket, not proof of identity.
 */
export function resolveClientIp(req: Record<string, any>): string {
    const header: unknown = req?.headers?.['x-forwarded-for'];
    const raw = Array.isArray(header) ? header[0] : header;
    if (typeof raw === 'string') {
        const first = raw.split(',')[0]?.trim();
        if (first) return first;
    }
    if (typeof req?.ip === 'string' && req.ip) return req.ip;
    const socketIp: unknown =
        req?.socket?.remoteAddress ?? req?.raw?.socket?.remoteAddress;
    return typeof socketIp === 'string' && socketIp ? socketIp : 'unknown';
}

/** Throttler keyed per client IP instead of per proxy IP. */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
    protected getTracker(req: Record<string, any>): Promise<string> {
        return Promise.resolve(resolveClientIp(req));
    }
}
