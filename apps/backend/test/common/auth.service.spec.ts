import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';

import { AuthService } from 'src/common/auth/services/auth.service';
import { CacheService } from 'src/common/cache/services/cache.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import { EmailService } from 'src/common/email/email.service';
import { HelperEncryptionService } from 'src/common/helper/services/helper.encryption.service';

// ─── Shared mock factories ────────────────────────────────────────────────────

const mockUser = (overrides = {}) => ({
    id: 'user-1',
    name: 'Jane Resident',
    email: 'jane@eastpark.app',
    passwordHash: '$argon2hash',
    role: Role.RESIDENT,
    isVerified: true,
    pushToken: null,
    ...overrides,
});

const mockTokens = {
    accessToken: 'access.jwt',
    refreshToken: 'refresh.jwt',
};

// ─── Mocks ────────────────────────────────────────────────────────────────────

const db = {
    user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
    },
    invitation: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
};

const cache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
};

const email = {
    sendOtp: jest.fn(),
    sendPasswordReset: jest.fn(),
};

const encryption = {
    createHash: jest.fn().mockResolvedValue('$hash'),
    match: jest.fn(),
    createJwtTokens: jest.fn().mockResolvedValue(mockTokens),
};

const config = {
    get: jest.fn((key: string) => {
        const map: Record<string, string> = {
            'app.url': 'http://localhost:3000',
            'auth.refreshToken.tokenExp': '7d',
        };
        return map[key];
    }),
    getOrThrow: jest.fn(),
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('AuthService', () => {
    let service: AuthService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: DatabaseService, useValue: db },
                { provide: CacheService, useValue: cache },
                { provide: EmailService, useValue: email },
                { provide: HelperEncryptionService, useValue: encryption },
                { provide: ConfigService, useValue: config },
            ],
        }).compile();

        service = module.get(AuthService);
    });

    // ── register ──────────────────────────────────────────────────────────────

    describe('register', () => {
        it('throws ConflictException when email already exists', async () => {
            db.user.findUnique.mockResolvedValue(mockUser());
            await expect(
                service.register({
                    name: 'Jane',
                    email: 'jane@eastpark.app',
                    password: 'Secret123!',
                    phone: '0500000000',
                    unitNumber: 'A1',
                })
            ).rejects.toBeInstanceOf(ConflictException);
        });

        it('creates user and sends OTP on success', async () => {
            db.user.findUnique.mockResolvedValue(null);
            db.user.create.mockResolvedValue(mockUser({ isVerified: false }));
            cache.set.mockResolvedValue(undefined);
            email.sendOtp.mockResolvedValue(undefined);

            const result = await service.register({
                name: 'Jane',
                email: 'jane@eastpark.app',
                password: 'Secret123!',
                phone: '0500000000',
                unitNumber: 'A1',
            });

            expect(db.user.create).toHaveBeenCalledTimes(1);
            expect(email.sendOtp).toHaveBeenCalledTimes(1);
            expect(result.message).toMatch(/OTP/i);
        });
    });

    // ── verifyOtp ─────────────────────────────────────────────────────────────

    describe('verifyOtp', () => {
        it('throws BadRequestException when OTP not found in cache', async () => {
            cache.get.mockResolvedValue(null);
            await expect(
                service.verifyOtp({ email: 'jane@eastpark.app', otp: '123456' })
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it('throws BadRequestException when OTP does not match', async () => {
            cache.get.mockResolvedValue('$storedHash');
            encryption.match.mockResolvedValue(false);
            await expect(
                service.verifyOtp({ email: 'jane@eastpark.app', otp: '000000' })
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it('returns tokens and marks user as verified on success', async () => {
            cache.get.mockResolvedValue('$storedHash');
            encryption.match.mockResolvedValue(true);
            cache.del.mockResolvedValue(undefined);
            db.user.update.mockResolvedValue(mockUser());

            const result = await service.verifyOtp({
                email: 'jane@eastpark.app',
                otp: '123456',
            });

            expect(db.user.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: { isVerified: true } })
            );
            expect(result.accessToken).toBe(mockTokens.accessToken);
        });
    });

    // ── login ─────────────────────────────────────────────────────────────────

    describe('login', () => {
        it('throws NotFoundException for unknown email', async () => {
            db.user.findUnique.mockResolvedValue(null);
            await expect(
                service.login({ email: 'unknown@eastpark.app', password: 'pw' })
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it('throws UnauthorizedException for wrong password', async () => {
            db.user.findUnique.mockResolvedValue(mockUser());
            encryption.match.mockResolvedValue(false);
            await expect(
                service.login({ email: 'jane@eastpark.app', password: 'wrong' })
            ).rejects.toBeInstanceOf(UnauthorizedException);
        });

        it('throws ForbiddenException when user email is not verified', async () => {
            db.user.findUnique.mockResolvedValue(
                mockUser({ isVerified: false })
            );
            encryption.match.mockResolvedValue(true);
            await expect(
                service.login({
                    email: 'jane@eastpark.app',
                    password: 'Secret123!',
                })
            ).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('returns tokens on successful login', async () => {
            db.user.findUnique.mockResolvedValue(mockUser());
            encryption.match.mockResolvedValue(true);

            const result = await service.login({
                email: 'jane@eastpark.app',
                password: 'Secret123!',
            });

            expect(result.accessToken).toBe(mockTokens.accessToken);
            expect(result.refreshToken).toBe(mockTokens.refreshToken);
        });
    });

    // ── refresh ───────────────────────────────────────────────────────────────

    describe('refresh', () => {
        it('throws UnauthorizedException when token is blacklisted', async () => {
            cache.exists.mockResolvedValue(true);
            await expect(
                service.refresh(
                    { userId: 'user-1', role: Role.RESIDENT },
                    'old.refresh.token'
                )
            ).rejects.toBeInstanceOf(UnauthorizedException);
        });

        it('returns new tokens and blacklists old token', async () => {
            cache.exists.mockResolvedValue(false);
            cache.set.mockResolvedValue(undefined);

            const result = await service.refresh(
                { userId: 'user-1', role: Role.RESIDENT },
                'old.refresh.token'
            );

            expect(cache.set).toHaveBeenCalledWith(
                expect.stringContaining('blacklist:'),
                '1',
                expect.any(Number)
            );
            expect(result.accessToken).toBe(mockTokens.accessToken);
        });
    });

    // ── logout ────────────────────────────────────────────────────────────────

    describe('logout', () => {
        it('blacklists the refresh token', async () => {
            cache.set.mockResolvedValue(undefined);

            const result = await service.logout('some.refresh.token');

            expect(cache.set).toHaveBeenCalledWith(
                expect.stringContaining('blacklist:'),
                '1',
                expect.any(Number)
            );
            expect(result.message).toBeDefined();
        });
    });

    // ── forgotPassword ────────────────────────────────────────────────────────

    describe('forgotPassword', () => {
        it('returns the same message when user does not exist (no email enumeration)', async () => {
            db.user.findUnique.mockResolvedValue(null);

            const result = await service.forgotPassword({
                email: 'noone@eastpark.app',
            });

            expect(email.sendPasswordReset).not.toHaveBeenCalled();
            expect(result.message).toMatch(/if that email/i);
        });

        it('sends reset email when user exists', async () => {
            db.user.findUnique.mockResolvedValue(mockUser());
            cache.set.mockResolvedValue(undefined);
            email.sendPasswordReset.mockResolvedValue(undefined);

            const result = await service.forgotPassword({
                email: 'jane@eastpark.app',
            });

            expect(email.sendPasswordReset).toHaveBeenCalledTimes(1);
            expect(result.message).toMatch(/if that email/i);
        });
    });

    // ── acceptInvitation ──────────────────────────────────────────────────────

    describe('acceptInvitation', () => {
        const validInvitation = {
            id: 'inv-1',
            email: 'merchant@eastpark.app',
            role: Role.MERCHANT,
            usedAt: null,
            expiresAt: new Date(Date.now() + 86400_000),
            token: 'signed-token',
        };

        it('throws NotFoundException for unknown token', async () => {
            db.invitation.findUnique.mockResolvedValue(null);
            await expect(
                service.acceptInvitation({
                    token: 'bad-token',
                    name: 'Ali',
                    password: 'Pass123!',
                })
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it('throws BadRequestException when invitation is already used', async () => {
            db.invitation.findUnique.mockResolvedValue({
                ...validInvitation,
                usedAt: new Date(),
            });
            await expect(
                service.acceptInvitation({
                    token: 'signed-token',
                    name: 'Ali',
                    password: 'Pass123!',
                })
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it('throws BadRequestException when invitation is expired', async () => {
            db.invitation.findUnique.mockResolvedValue({
                ...validInvitation,
                expiresAt: new Date(Date.now() - 1000),
            });
            await expect(
                service.acceptInvitation({
                    token: 'signed-token',
                    name: 'Ali',
                    password: 'Pass123!',
                })
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it('creates merchant account and marks invitation as used', async () => {
            db.invitation.findUnique.mockResolvedValue(validInvitation);
            db.user.upsert.mockResolvedValue(
                mockUser({
                    role: Role.MERCHANT,
                    email: 'merchant@eastpark.app',
                })
            );
            db.invitation.update.mockResolvedValue({});

            const result = await service.acceptInvitation({
                token: 'signed-token',
                name: 'Ali Merchant',
                password: 'Pass123!',
            });

            expect(db.invitation.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ usedAt: expect.any(Date) }),
                })
            );
            expect(result.accessToken).toBe(mockTokens.accessToken);
        });
    });
});
