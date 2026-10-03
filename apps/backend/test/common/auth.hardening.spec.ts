import { Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AuthPublicController } from 'src/common/auth/controllers/auth.public.controller';
import {
    AuthForgotPasswordDto,
    AuthLoginDto,
    AuthLogoutDto,
} from 'src/common/auth/dtos/request/auth.dto';
import { AuthService } from 'src/common/auth/services/auth.service';
import { maskEmail, maskToken } from 'src/common/helper/utils/redact';
import { resolveClientIp } from 'src/common/request/guards/client-ip-throttler.guard';
import { InvitationCreateDto } from 'src/modules/invitations/dtos/request/invitation.create.dto';

describe('resolveClientIp (throttler tracker)', () => {
    const SECRET = 'a'.repeat(48);
    const spoofed = {
        ip: '198.51.100.20',
        headers: { 'x-forwarded-for': '203.0.113.7, 198.51.100.20' },
    };

    it('ignores a spoofed X-Forwarded-For when no secret is configured', () => {
        expect(resolveClientIp(spoofed)).toBe('198.51.100.20');
        expect(
            resolveClientIp({
                ...spoofed,
                headers: { ...spoofed.headers, 'x-eastpark-internal': SECRET },
            })
        ).toBe('198.51.100.20');
    });

    it('ignores X-Forwarded-For from a caller without the internal header', () => {
        expect(resolveClientIp(spoofed, SECRET)).toBe('198.51.100.20');
    });

    it('ignores X-Forwarded-For when the internal header is wrong', () => {
        for (const wrong of ['nope', SECRET.slice(1), `${SECRET}x`, '']) {
            expect(
                resolveClientIp(
                    {
                        ...spoofed,
                        headers: {
                            ...spoofed.headers,
                            'x-eastpark-internal': wrong,
                        },
                    },
                    SECRET
                )
            ).toBe('198.51.100.20');
        }
    });

    it('uses the BFF-supplied client IP when the secret matches', () => {
        const fromBff = (xff: string) =>
            resolveClientIp(
                {
                    ip: '76.76.21.1', // Vercel egress as seen by Render
                    headers: {
                        'x-eastpark-internal': SECRET,
                        'x-forwarded-for': xff,
                    },
                },
                SECRET
            );
        expect(fromBff('203.0.113.7, 76.76.21.1')).toBe('203.0.113.7');
        expect(fromBff('2001:db8::7')).toBe('2001:db8::7');
        // Two residents behind the BFF get separate buckets.
        expect(fromBff('198.51.100.1')).not.toBe(fromBff('198.51.100.2'));
    });

    it('falls back to req.ip when the trusted client IP is not a valid IP', () => {
        expect(
            resolveClientIp(
                {
                    ip: '76.76.21.1',
                    headers: {
                        'x-eastpark-internal': SECRET,
                        'x-forwarded-for': 'not-an-ip, 76.76.21.1',
                    },
                },
                SECRET
            )
        ).toBe('76.76.21.1');
    });

    const EDGE = '172.70.1.1'; // Cloudflare edge, as req.ip on Render

    it('keys direct traffic on CF-Connecting-IP, not the edge req.ip', () => {
        expect(
            resolveClientIp({
                ip: EDGE,
                headers: { 'cf-connecting-ip': '203.0.113.9' },
            })
        ).toBe('203.0.113.9');
        expect(
            resolveClientIp(
                {
                    ip: EDGE,
                    headers: { 'true-client-ip': '2001:db8::9' },
                },
                SECRET
            )
        ).toBe('2001:db8::9');
    });

    it('prefers CF-Connecting-IP over True-Client-IP', () => {
        expect(
            resolveClientIp({
                ip: EDGE,
                headers: {
                    'cf-connecting-ip': '203.0.113.9',
                    'true-client-ip': '203.0.113.66',
                },
            })
        ).toBe('203.0.113.9');
    });

    it('ignores a spoofed X-Forwarded-For when the CF header is present', () => {
        expect(
            resolveClientIp(
                {
                    ip: EDGE,
                    headers: {
                        'cf-connecting-ip': '203.0.113.9',
                        'x-forwarded-for': '6.6.6.6, 203.0.113.9, 172.70.1.1',
                        'x-eastpark-client-ip': '6.6.6.6',
                    },
                },
                SECRET
            )
        ).toBe('203.0.113.9');
    });

    it('uses X-EastPark-Client-IP from the BFF over CF and XFF', () => {
        expect(
            resolveClientIp(
                {
                    ip: EDGE,
                    headers: {
                        'x-eastpark-internal': SECRET,
                        'x-eastpark-client-ip': '198.51.100.77',
                        'cf-connecting-ip': '76.76.21.1', // Vercel egress
                        'x-forwarded-for': '198.51.100.1, 76.76.21.1',
                    },
                },
                SECRET
            )
        ).toBe('198.51.100.77');
    });

    it('ignores X-EastPark-Client-IP when the secret is wrong or unset', () => {
        const headers = {
            'x-eastpark-client-ip': '198.51.100.77',
            'cf-connecting-ip': '203.0.113.9',
        };
        for (const wrong of ['nope', SECRET.slice(1), '']) {
            expect(
                resolveClientIp(
                    {
                        ip: EDGE,
                        headers: { ...headers, 'x-eastpark-internal': wrong },
                    },
                    SECRET
                )
            ).toBe('203.0.113.9');
        }
        expect(
            resolveClientIp({
                ip: EDGE,
                headers: { ...headers, 'x-eastpark-internal': SECRET },
            })
        ).toBe('203.0.113.9');
    });

    it('ignores invalid IPs in every client-IP header', () => {
        expect(
            resolveClientIp(
                {
                    ip: EDGE,
                    headers: {
                        'x-eastpark-internal': SECRET,
                        'x-eastpark-client-ip': '1.2.3.4:443',
                        'x-forwarded-for': 'garbage',
                        'cf-connecting-ip': 'not-an-ip',
                        'true-client-ip': '203.0.113.5',
                    },
                },
                SECRET
            )
        ).toBe('203.0.113.5');
        expect(
            resolveClientIp({
                ip: EDGE,
                headers: {
                    'cf-connecting-ip': '',
                    'true-client-ip': '999.1.1.1',
                },
            })
        ).toBe(EDGE);
    });

    it('falls back to req.ip, then the socket address', () => {
        expect(resolveClientIp({ ip: '192.0.2.4', headers: {} })).toBe(
            '192.0.2.4'
        );
        expect(
            resolveClientIp({
                headers: {},
                socket: { remoteAddress: '192.0.2.9' },
            })
        ).toBe('192.0.2.9');
    });
});

describe('email normalization at the DTO boundary', () => {
    it.each([
        ['AuthLoginDto', AuthLoginDto],
        ['AuthForgotPasswordDto', AuthForgotPasswordDto],
        ['InvitationCreateDto', InvitationCreateDto],
    ])('%s trims and lower-cases email', (_name, Dto) => {
        const instance = plainToInstance(Dto as new () => { email: string }, {
            email: '  Jane.Doe@EastPark.APP ',
        });
        expect(instance.email).toBe('jane.doe@eastpark.app');
    });
});

describe('AuthLogoutDto', () => {
    it('accepts a body without refreshToken (header is authoritative)', async () => {
        const errors = await validate(plainToInstance(AuthLogoutDto, {}));
        expect(errors).toHaveLength(0);
    });
});

describe('AuthPublicController.refresh', () => {
    it('passes the Authorization header token (not the body) to the service', async () => {
        const authService = { refresh: jest.fn().mockResolvedValue({}) };
        const controller = new AuthPublicController(
            authService as unknown as AuthService
        );
        const payload = { userId: 'u1', role: Role.RESIDENT };

        await controller.refresh(
            payload,
            {
                headers: { authorization: 'Bearer header.refresh.token' },
            } as never,
            { refreshToken: 'body.token' }
        );

        expect(authService.refresh).toHaveBeenCalledWith(
            payload,
            'header.refresh.token',
            'body.token'
        );
    });
});

describe('log redaction', () => {
    it('masks emails', () => {
        expect(maskEmail('ahmed@example.com')).toBe('a***@example.com');
        expect(maskEmail('broken')).toBe('***');
    });

    it('masks tokens', () => {
        expect(maskToken('ExponentPushToken[abcdefgh1234]')).toBe(
            '***234](31)'
        );
        expect(maskToken('short')).toBe('***(5)');
    });
});
