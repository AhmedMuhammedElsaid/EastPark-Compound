import { registerAs } from '@nestjs/config';

import { APP_ENVIRONMENT } from 'src/app/enums/app.enum';

export default registerAs('app', (): Record<string, unknown> => {
    const env = process.env.APP_ENV ?? APP_ENVIRONMENT.LOCAL;
    const raw = (process.env.APP_CORS_ORIGINS ?? '*').trim();
    // '*' → true: @fastify/cors REFLECTS the caller's Origin. Browsers reject a
    // literal '*' alongside credentials:true, but they accept reflection — so
    // this is an allow-any-origin credentialed policy, not a harmless default.
    // Never ship it: set APP_CORS_ORIGINS to an explicit comma-separated list.
    // Empty/blank entries are dropped — an empty string in the allowlist would
    // match no origin and silently break every browser client with no error.
    const parsed = raw
        .split(',')
        .map(o => o.trim())
        .filter(o => o.length > 0);
    const corsOrigins: boolean | string[] =
        raw === '*' || parsed.length === 0 ? true : parsed;

    if (env === APP_ENVIRONMENT.PRODUCTION && corsOrigins === true) {
        throw new Error(
            'APP_CORS_ORIGINS must contain explicit origins in production'
        );
    }

    // Shared secret the Vercel BFF sends in `X-EastPark-Internal`. Only a
    // request carrying it may tell us the browser IP via X-EastPark-Client-IP
    // (or, as a fallback, the left-most X-Forwarded-For). Unset or mismatched →
    // BFF traffic is keyed on Vercel's egress IP via CF-Connecting-IP, so web
    // users share buckets: set the identical value on Vercel and Render.
    const bffInternalSecret = process.env.BFF_INTERNAL_SECRET?.trim() || '';
    if (bffInternalSecret && bffInternalSecret.length < 32) {
        throw new Error('BFF_INTERNAL_SECRET must be at least 32 characters');
    }

    return {
        env,
        bffInternalSecret: bffInternalSecret || undefined,
        name: process.env.APP_NAME ?? 'EastPark API',
        url: process.env.APP_URL ?? 'http://localhost:3000',
        webUrl:
            process.env.WEB_APP_URL ??
            (env === 'production'
                ? 'https://eastpark-web-app.vercel.app'
                : 'http://localhost:3000'),

        throttle: {
            ttl: 60,
            limit: 100,
        },

        http: {
            host: process.env.HTTP_HOST ?? '0.0.0.0',
            port: process.env.HTTP_PORT
                ? parseInt(process.env.HTTP_PORT, 10)
                : 3000,
        },

        cors: {
            origin: corsOrigins,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
            credentials: true,
        },

        logLevel: process.env.APP_LOG_LEVEL ?? 'info',
    };
});
