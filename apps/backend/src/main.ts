import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
    FastifyAdapter,
    NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import { useContainer } from 'class-validator';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app/app.module';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        // Trust exactly one proxy hop (Render's proxy) so req.protocol/hostname
        // honour X-Forwarded-Proto/Host and req.ip is the right-most XFF hop.
        // Behind Cloudflare + Render that hop is the Cloudflare edge (varies
        // per request, shared by unrelated users), so req.ip is NOT a client
        // identity: rate limiting resolves the client from CF-Connecting-IP or
        // the secret-gated BFF header instead (see ClientIpThrottlerGuard).
        // `true` would make req.ip the spoofable left-most XFF entry; `false`
        // would collapse it to Render's internal 10.x peer.
        new FastifyAdapter({ logger: false, trustProxy: 1 }),
        { bufferLogs: true }
    );

    const config = app.get(ConfigService);
    const logger = app.get(Logger);
    const env = config.get<string>('app.env');
    const host = config.getOrThrow<string>('app.http.host');
    const port = config.getOrThrow<number>('app.http.port');

    // Pino logger
    app.useLogger(logger);

    // Security headers
    await app.register(fastifyHelmet, {
        contentSecurityPolicy: env === 'production',
    });

    // Multipart (file uploads)
    await app.register(fastifyMultipart, {
        limits: {
            fileSize: 20 * 1024 * 1024, // 20MB max (enforced per-endpoint too)
            files: 1,
        },
    });

    // CORS
    await app.register(fastifyCors, {
        origin: config.get<boolean | string[]>('app.cors.origin') ?? true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: true,
    });

    // Validation
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        })
    );

    // URI versioning — all routes prefixed /v1/
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
    });

    useContainer(app.select(AppModule), { fallbackOnErrors: true });

    // Swagger — dev/staging only
    if (env !== 'production') {
        const { default: setupSwagger } = await import('./swagger');
        setupSwagger(app);
    }

    // Graceful shutdown: Nest closes the app once on SIGTERM/SIGINT. No
    // manual signal handlers — they made app.close() run twice.
    app.enableShutdownHooks();

    await app.listen(port, host);
    logger.log(`EastPark API running → http://${host}:${port}/v1`);
}

bootstrap();
