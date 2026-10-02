import { Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AuthPublicController } from 'src/common/auth/controllers/auth.public.controller';
import {
    AuthForgotPasswordDto,
    AuthLoginDto,
    AuthLogoutDto,
    AuthRegisterDto,
    AuthResendOtpDto,
    AuthVerifyOtpDto,
} from 'src/common/auth/dtos/request/auth.dto';
import { AuthService } from 'src/common/auth/services/auth.service';
import { maskEmail, maskToken } from 'src/common/helper/utils/redact';
import { resolveClientIp } from 'src/common/request/guards/client-ip-throttler.guard';
import { InvitationCreateDto } from 'src/modules/invitations/dtos/request/invitation.create.dto';

describe('resolveClientIp (throttler tracker)', () => {
    it('uses the left-most X-Forwarded-For entry (original client)', () => {
        expect(
            resolveClientIp({
                ip: '10.0.0.1',
                headers: {
                    'x-forwarded-for': '203.0.113.7, 76.76.21.1, 10.0.0.1',
                },
            })
        ).toBe('203.0.113.7');
    });

    it('gives two clients behind the same proxy different buckets', () => {
        const a = resolveClientIp({
            ip: '10.0.0.1',
            headers: { 'x-forwarded-for': '198.51.100.1, 10.0.0.1' },
        });
        const b = resolveClientIp({
            ip: '10.0.0.1',
            headers: { 'x-forwarded-for': '198.51.100.2, 10.0.0.1' },
        });
        expect(a).not.toBe(b);
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
        ['AuthRegisterDto', AuthRegisterDto],
        ['AuthVerifyOtpDto', AuthVerifyOtpDto],
        ['AuthResendOtpDto', AuthResendOtpDto],
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
