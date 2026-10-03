import { ExecutionContext, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import {
    FastifyAdapter,
    NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { Role } from '@prisma/client';

import { AuthPublicController } from 'src/common/auth/controllers/auth.public.controller';
import { AuthService } from 'src/common/auth/services/auth.service';
import { MessageService } from 'src/common/message/services/message.service';
import { ClientIpThrottlerGuard } from 'src/common/request/guards/client-ip-throttler.guard';
import { JwtAccessGuard } from 'src/common/request/guards/jwt.access.guard';
import { JwtRefreshGuard } from 'src/common/request/guards/jwt.refresh.guard';
import { ResponseExceptionFilter } from 'src/common/response/filters/response.exception.filter';

const SECRET = 'b'.repeat(48);

/**
 * Boots the real auth controller on Fastify with the real throttler guard
 * and the real exception filter (only AuthService and the JWT guards are
 * stubbed), and drives it with HTTP requests.
 */
describe('Auth route throttling (HTTP)', () => {
    let app: NestFastifyApplication;
    const authService = {
        login: jest.fn().mockResolvedValue({ accessToken: 'a' }),
        refresh: jest.fn().mockResolvedValue({ accessToken: 'a' }),
        logout: jest.fn().mockResolvedValue({ message: 'ok' }),
        updatePushToken: jest.fn().mockResolvedValue(undefined),
    };
    const allow = {
        canActivate: (ctx: ExecutionContext) => {
            const req = ctx.switchToHttp().getRequest<{ user?: unknown }>();
            req.user = { userId: 'u1', role: Role.RESIDENT };
            return true;
        },
    };

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ThrottlerModule.forRoot({
                    throttlers: [{ ttl: 60000, limit: 100 }],
                }),
            ],
            controllers: [AuthPublicController],
            providers: [
                { provide: AuthService, useValue: authService },
                {
                    provide: ConfigService,
                    useValue: {
                        get: (key: string) =>
                            key === 'app.bffInternalSecret'
                                ? SECRET
                                : undefined,
                    },
                },
                {
                    provide: MessageService,
                    useValue: {
                        translate: (
                            key: string,
                            o?: { defaultValue?: string }
                        ) => o?.defaultValue ?? key,
                        translateKey: (
                            _k: string[],
                            o?: { defaultValue?: string }
                        ) => o?.defaultValue ?? '',
                    },
                },
                { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
                { provide: APP_FILTER, useClass: ResponseExceptionFilter },
            ],
        })
            .overrideGuard(JwtRefreshGuard)
            .useValue(allow)
            .overrideGuard(JwtAccessGuard)
            .useValue(allow)
            .compile();

        app = moduleRef.createNestApplication<NestFastifyApplication>(
            new FastifyAdapter({ trustProxy: 1 })
        );
        app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterEach(async () => {
        await app.close();
    });

    const post = (
        url: string,
        opts: { remoteAddress?: string; headers?: Record<string, string> } = {}
    ) =>
        app.inject({
            method: 'POST',
            url,
            payload: { email: 'jane@eastpark.app', password: 'x' },
            remoteAddress: opts.remoteAddress ?? '198.51.100.20',
            headers: opts.headers,
        });

    it('returns HTTP 429 (not 5xx) on the 6th login per minute', async () => {
        const statuses: number[] = [];
        for (let i = 0; i < 6; i++)
            statuses.push((await post('/v1/auth/login')).statusCode);
        expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    });

    it('cannot be bypassed by rotating X-Forwarded-For without the secret', async () => {
        // As on Render: the TCP peer is Render's proxy (one trusted hop) and
        // it APPENDS the real peer address after whatever the caller sent.
        const statuses: number[] = [];
        for (let i = 0; i < 6; i++) {
            const res = await post('/v1/auth/login', {
                remoteAddress: '10.0.0.1',
                headers: {
                    'x-forwarded-for': `203.0.113.${i}, 198.51.100.20`,
                },
            });
            statuses.push(res.statusCode);
        }
        expect(statuses[5]).toBe(429);
    });

    it('keys BFF requests (valid secret) on the forwarded client IP', async () => {
        const viaBff = (clientIp: string) =>
            post('/v1/auth/login', {
                remoteAddress: '76.76.21.1',
                headers: {
                    'x-eastpark-internal': SECRET,
                    'x-forwarded-for': clientIp,
                },
            });
        for (let i = 0; i < 5; i++)
            expect((await viaBff('203.0.113.1')).statusCode).toBe(200);
        expect((await viaBff('203.0.113.1')).statusCode).toBe(429);
        // A different resident behind the same BFF is unaffected.
        expect((await viaBff('203.0.113.2')).statusCode).toBe(200);
    });

    it('gives refresh a roomier per-route bucket than login', async () => {
        const statuses: number[] = [];
        for (let i = 0; i < 20; i++)
            statuses.push((await post('/v1/auth/refresh')).statusCode);
        expect(statuses.every(s => s === 200)).toBe(true);
    });
});
