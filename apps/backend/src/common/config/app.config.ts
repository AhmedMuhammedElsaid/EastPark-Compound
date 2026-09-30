import { registerAs } from '@nestjs/config';

import { APP_ENVIRONMENT } from 'src/app/enums/app.enum';

export default registerAs('app', (): Record<string, unknown> => {
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

    return {
        env: process.env.APP_ENV ?? APP_ENVIRONMENT.LOCAL,
        name: process.env.APP_NAME ?? 'EastPark API',
        url: process.env.APP_URL ?? 'http://localhost:3000',

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
