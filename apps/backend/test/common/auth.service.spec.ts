import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    HttpException,
    HttpStatus,
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
        updateMany: jest.fn(),
    },
    residentLead: {
        findFirst: jest.fn(),
        update: jest.fn(),
    },
    // Interactive transaction: run the callback against the same mocks.
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(db)),
};

const cache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
};

const email = {
    sendOtp: jest.fn(),
    sendPasswordReset: jest.fn(),
};

const encryption = {
    createHash: jest.fn().mockResolvedValue('$hash'),
    match: jest.fn(),
    createJwtTokens: jest.fn().mockResolvedValue(mockTokens),
    verifyRefreshToken: jest.fn(),
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
        // Defaults: no session-version bump recorded, first INCR wins.
        cache.get.mockResolvedValue(null);
        cache.incr.mockResolvedValue(1);
        db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
            fn(db)
        );

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

        it('maps a concurrent duplicate registration (P2002) to 409', async () => {
            db.user.findUnique.mockResolvedValue(null);
            db.user.create.mockRejectedValue({ code: 'P2002' });
            await expect(
                service.register({
                    name: 'Jane',
                    email: 'jane@eastpark.app',
                    password: 'Secret123!',
                    phone: '0500000000',
                    unitNumber: 'A1',
                })
            ).rejects.toBeInstanceOf(ConflictException);
            expect(email.sendOtp).not.toHaveBeenCalled();
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
        it('throws 401 "Invalid credentials" for unknown email (no enumeration)', async () => {
            db.user.findUnique.mockResolvedValue(null);
            encryption.match.mockResolvedValue(false);
            const attempt = service.login({
                email: 'unknown@eastpark.app',
                password: 'pw',
            });
            await expect(attempt).rejects.toBeInstanceOf(UnauthorizedException);
            await expect(attempt).rejects.toThrow('Invalid credentials');
            // Still runs a hash comparison so timing matches a wrong password.
            expect(encryption.match).toHaveBeenCalledTimes(1);
        });

        it('looks the user up by the normalized email', async () => {
            db.user.findUnique.mockResolvedValue(mockUser());
            encryption.match.mockResolvedValue(true);
            await service.login({
                email: '  Jane@EastPark.App ',
                password: 'Secret123!',
            });
            expect(db.user.findUnique).toHaveBeenCalledWith({
                where: { email: 'jane@eastpark.app' },
            });
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

        describe('per-email failure cap', () => {
            it('counts attempts per normalized email with a 15-minute window', async () => {
                db.user.findUnique.mockResolvedValue(mockUser());
                encryption.match.mockResolvedValue(false);
                cache.incr.mockResolvedValueOnce(1);
                await expect(
                    service.login({
                        email: ' Jane@EastPark.app',
                        password: 'wrong',
                    })
                ).rejects.toBeInstanceOf(UnauthorizedException);
                expect(cache.incr).toHaveBeenCalledWith(
                    'login-attempts:jane@eastpark.app'
                );
                expect(cache.expire).toHaveBeenCalledWith(
                    'login-attempts:jane@eastpark.app',
                    900
                );
            });

            it('returns 429 on the 11th attempt without checking the password', async () => {
                db.user.findUnique.mockResolvedValue(mockUser());
                encryption.match.mockResolvedValue(true);
                cache.incr.mockResolvedValueOnce(11);
                const attempt = service.login({
                    email: 'jane@eastpark.app',
                    password: 'Secret123!',
                });
                await expect(attempt).rejects.toBeInstanceOf(HttpException);
                await expect(attempt).rejects.toMatchObject({
                    status: HttpStatus.TOO_MANY_REQUESTS,
                });
                expect(db.user.findUnique).not.toHaveBeenCalled();
                expect(encryption.match).not.toHaveBeenCalled();
            });

            it('caps unknown emails the same way (no enumeration via 429)', async () => {
                db.user.findUnique.mockResolvedValue(null);
                cache.incr.mockResolvedValueOnce(11);
                await expect(
                    service.login({
                        email: 'ghost@eastpark.app',
                        password: 'x',
                    })
                ).rejects.toMatchObject({
                    status: HttpStatus.TOO_MANY_REQUESTS,
                });
            });

            it('holds across many IPs: 10 failures then 429', async () => {
                db.user.findUnique.mockResolvedValue(mockUser());
                encryption.match.mockResolvedValue(false);
                let counter = 0;
                cache.incr.mockImplementation(() => Promise.resolve(++counter));
                const results = await Promise.allSettled(
                    Array.from({ length: 15 }, () =>
                        service.login({
                            email: 'jane@eastpark.app',
                            password: 'guess',
                        })
                    )
                );
                const statuses = results.map(r =>
                    r.status === 'rejected'
                        ? (r.reason as HttpException).getStatus()
                        : 200
                );
                expect(statuses.filter(s => s === 401)).toHaveLength(10);
                expect(statuses.filter(s => s === 429)).toHaveLength(5);
                expect(encryption.match).toHaveBeenCalledTimes(10);
            });

            it('clears the counter after a correct password', async () => {
                db.user.findUnique.mockResolvedValue(mockUser());
                encryption.match.mockResolvedValue(true);
                await service.login({
                    email: 'jane@eastpark.app',
                    password: 'Secret123!',
                });
                expect(cache.del).toHaveBeenCalledWith(
                    'login-attempts:jane@eastpark.app'
                );
            });
        });
    });

    // ── refresh ───────────────────────────────────────────────────────────────

    describe('refresh', () => {
        const payload = {
            userId: 'user-1',
            role: Role.RESIDENT,
            jti: 'jti-1',
            exp: Math.floor(Date.now() / 1000) + 3600,
        };

        it('rejects a body token that differs from the header token', async () => {
            await expect(
                service.refresh(payload, 'header.token', 'other.token')
            ).rejects.toBeInstanceOf(UnauthorizedException);
            expect(cache.incr).not.toHaveBeenCalled();
        });

        it('rotates the HEADER token, re-deriving the role from the DB', async () => {
            db.user.findUnique.mockResolvedValue(
                mockUser({ role: Role.MERCHANT })
            );

            const result = await service.refresh(
                payload,
                'header.token',
                'header.token'
            );

            expect(cache.incr).toHaveBeenCalledWith('blacklist:jti:jti-1');
            expect(cache.expire).toHaveBeenCalledWith(
                'blacklist:jti:jti-1',
                expect.any(Number)
            );
            expect(encryption.createJwtTokens).toHaveBeenCalledWith({
                userId: 'user-1',
                role: Role.MERCHANT,
                ver: 0,
            });
            expect(result.accessToken).toBe(mockTokens.accessToken);
        });

        it('rejects a replayed refresh token after rotation', async () => {
            db.user.findUnique.mockResolvedValue(mockUser());
            const store = new Map<string, number>();
            cache.incr.mockImplementation((key: string) => {
                const next = (store.get(key) ?? 0) + 1;
                store.set(key, next);
                return Promise.resolve(next);
            });

            await service.refresh(payload, 'header.token');
            await expect(
                service.refresh(payload, 'header.token')
            ).rejects.toThrow('Token revoked');
            expect(encryption.createJwtTokens).toHaveBeenCalledTimes(1);
        });

        it('falls back to the raw token as key for legacy tokens without jti', async () => {
            db.user.findUnique.mockResolvedValue(mockUser());
            await service.refresh(
                { userId: 'user-1', role: Role.RESIDENT },
                'legacy.token'
            );
            expect(cache.incr).toHaveBeenCalledWith('blacklist:legacy.token');
        });

        it('rejects when the user no longer exists', async () => {
            db.user.findUnique.mockResolvedValue(null);
            await expect(
                service.refresh(payload, 'header.token')
            ).rejects.toBeInstanceOf(UnauthorizedException);
            expect(encryption.createJwtTokens).not.toHaveBeenCalled();
        });

        it('rejects when the user is not verified', async () => {
            db.user.findUnique.mockResolvedValue(
                mockUser({ isVerified: false })
            );
            await expect(
                service.refresh(payload, 'header.token')
            ).rejects.toBeInstanceOf(UnauthorizedException);
        });

        it('rejects tokens issued before a password reset (session version bump)', async () => {
            cache.get.mockImplementation((key: string) =>
                Promise.resolve(key === 'session-version:user-1' ? '1' : null)
            );
            await expect(
                service.refresh({ ...payload, ver: 0 }, 'header.token')
            ).rejects.toThrow('Session expired');
            expect(cache.incr).not.toHaveBeenCalled();
        });

        it('accepts tokens carrying the current session version', async () => {
            cache.get.mockImplementation((key: string) =>
                Promise.resolve(key === 'session-version:user-1' ? '1' : null)
            );
            db.user.findUnique.mockResolvedValue(mockUser());
            await service.refresh({ ...payload, ver: 1 }, 'header.token');
            expect(encryption.createJwtTokens).toHaveBeenCalledWith(
                expect.objectContaining({ ver: 1 })
            );
        });
    });

    // ── logout ────────────────────────────────────────────────────────────────

    describe('logout', () => {
        const actor = { userId: 'user-1', role: Role.RESIDENT };

        it('revokes the body refresh token when it belongs to the caller', async () => {
            encryption.verifyRefreshToken.mockResolvedValue({
                userId: 'user-1',
                role: Role.RESIDENT,
                jti: 'jti-9',
                exp: Math.floor(Date.now() / 1000) + 60,
            });

            const result = await service.logout(actor, 'some.refresh.token');

            expect(cache.set).toHaveBeenCalledWith(
                'blacklist:jti:jti-9',
                '1',
                expect.any(Number)
            );
            expect(result.message).toBeDefined();
        });

        it('does not revoke a refresh token owned by another user', async () => {
            encryption.verifyRefreshToken.mockResolvedValue({
                userId: 'someone-else',
                role: Role.RESIDENT,
                jti: 'jti-x',
            });
            await service.logout(actor, 'foreign.token');
            expect(cache.set).not.toHaveBeenCalled();
        });

        it('succeeds without revoking when the token is invalid or missing', async () => {
            encryption.verifyRefreshToken.mockRejectedValue(new Error('bad'));
            await service.logout(actor, 'garbage');
            await service.logout(actor);
            expect(cache.set).not.toHaveBeenCalled();
        });
    });

    // ── verifyOtp attempt limit ───────────────────────────────────────────────

    describe('verifyOtp attempt limit', () => {
        it('normalizes the email for the OTP key and user update', async () => {
            cache.get.mockResolvedValue('$storedHash');
            encryption.match.mockResolvedValue(true);
            db.user.update.mockResolvedValue(mockUser());
            await service.verifyOtp({
                email: ' Jane@EastPark.app',
                otp: '123456',
            });
            expect(cache.get).toHaveBeenCalledWith('otp:jane@eastpark.app');
            expect(db.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { email: 'jane@eastpark.app' },
                })
            );
        });

        it('counts failures and burns the OTP on the 5th', async () => {
            cache.get.mockResolvedValue('$storedHash');
            encryption.match.mockResolvedValue(false);

            cache.incr.mockResolvedValueOnce(1);
            await expect(
                service.verifyOtp({ email: 'jane@eastpark.app', otp: '000000' })
            ).rejects.toThrow('Invalid OTP');
            expect(cache.expire).toHaveBeenCalledWith(
                'otp-attempts:jane@eastpark.app',
                600
            );
            expect(cache.del).not.toHaveBeenCalled();

            cache.incr.mockResolvedValueOnce(5);
            await expect(
                service.verifyOtp({ email: 'jane@eastpark.app', otp: '000000' })
            ).rejects.toThrow(/too many/i);
            expect(cache.del).toHaveBeenCalledWith('otp:jane@eastpark.app');
        });

        it('rejects without comparing once the attempt budget is spent', async () => {
            cache.get.mockResolvedValue('$storedHash');
            encryption.match.mockResolvedValue(true);
            cache.incr.mockResolvedValueOnce(6);

            await expect(
                service.verifyOtp({ email: 'jane@eastpark.app', otp: '123456' })
            ).rejects.toThrow(/too many/i);
            expect(encryption.match).not.toHaveBeenCalled();
            expect(db.user.update).not.toHaveBeenCalled();
            expect(cache.del).toHaveBeenCalledWith('otp:jane@eastpark.app');
        });

        it('compares at most 5 of many concurrent guesses', async () => {
            cache.get.mockResolvedValue('$storedHash');
            // Atomic counter, as Redis INCR provides.
            let counter = 0;
            cache.incr.mockImplementation(() => Promise.resolve(++counter));
            encryption.match.mockImplementation(
                () =>
                    new Promise(resolve => setTimeout(() => resolve(false), 5))
            );

            const results = await Promise.allSettled(
                Array.from({ length: 20 }, (_, i) =>
                    service.verifyOtp({
                        email: 'jane@eastpark.app',
                        otp: String(100000 + i),
                    })
                )
            );

            expect(results.every(r => r.status === 'rejected')).toBe(true);
            expect(encryption.match).toHaveBeenCalledTimes(5);
        });
    });

    // ── resetPassword ─────────────────────────────────────────────────────────

    describe('resetPassword', () => {
        it('updates the hash and bumps the session version', async () => {
            cache.get.mockResolvedValue('jane@eastpark.app');
            db.user.update.mockResolvedValue(mockUser());

            await service.resetPassword({ token: 't', password: 'NewPass1!' });

            expect(db.user.update).toHaveBeenCalledWith({
                where: { email: 'jane@eastpark.app' },
                data: { passwordHash: '$hash' },
            });
            expect(cache.incr).toHaveBeenCalledWith('session-version:user-1');
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
            db.user.findUnique.mockResolvedValue(null);
            db.invitation.updateMany.mockResolvedValue({ count: 1 });
            db.user.create.mockResolvedValue(
                mockUser({
                    role: Role.MERCHANT,
                    email: 'merchant@eastpark.app',
                })
            );

            const result = await service.acceptInvitation({
                token: 'signed-token',
                name: 'Ali Merchant',
                password: 'Pass123!',
            });

            expect(db.invitation.updateMany).toHaveBeenCalledWith({
                where: { id: 'inv-1', usedAt: null },
                data: { usedAt: expect.any(Date) },
            });
            expect(db.user.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    email: 'merchant@eastpark.app',
                    role: Role.MERCHANT,
                    passwordHash: '$hash',
                }),
            });
            expect(db.residentLead.findFirst).not.toHaveBeenCalled();
            expect(result.accessToken).toBe(mockTokens.accessToken);
        });

        it('rejects a concurrent second use of the same invitation', async () => {
            db.invitation.findUnique.mockResolvedValue(validInvitation);
            db.user.findUnique.mockResolvedValue(null);
            db.invitation.updateMany.mockResolvedValue({ count: 0 });

            await expect(
                service.acceptInvitation({
                    token: 'signed-token',
                    name: 'Ali',
                    password: 'Pass123!',
                })
            ).rejects.toThrow('Invitation already used');
            expect(db.user.create).not.toHaveBeenCalled();
        });

        it('links a RESIDENT invitation to its lead: copies phone/unit, marks CONVERTED', async () => {
            db.invitation.findUnique.mockResolvedValue({
                ...validInvitation,
                email: 'Resident@EastPark.app',
                role: Role.RESIDENT,
            });
            db.user.findUnique.mockResolvedValue(null);
            db.residentLead.findFirst.mockResolvedValue({
                id: 'lead-1',
                phone: '01000400163',
                building: 'A1',
                floor: '3',
                flatNumber: '12',
            });
            db.invitation.updateMany.mockResolvedValue({ count: 1 });
            db.user.create.mockResolvedValue(
                mockUser({ id: 'user-9', email: 'resident@eastpark.app' })
            );

            await service.acceptInvitation({
                token: 'signed-token',
                name: 'Resident',
                password: 'Pass123!',
            });

            expect(db.residentLead.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        email: 'resident@eastpark.app',
                    }),
                })
            );
            expect(db.user.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    email: 'resident@eastpark.app',
                    phone: '01000400163',
                    unitNumber: 'A1-3-12',
                }),
            });
            expect(db.residentLead.update).toHaveBeenCalledWith({
                where: { id: 'lead-1' },
                data: { userId: 'user-9', status: 'CONVERTED' },
            });
        });

        it('rejects an invitation for an existing account without its current password', async () => {
            db.invitation.findUnique.mockResolvedValue(validInvitation);
            db.user.findUnique.mockResolvedValue(mockUser());
            encryption.match.mockResolvedValue(false);

            await expect(
                service.acceptInvitation({
                    token: 'signed-token',
                    name: 'Ali',
                    password: 'Wrong123!',
                })
            ).rejects.toBeInstanceOf(ConflictException);
            expect(db.user.update).not.toHaveBeenCalled();
            expect(db.invitation.updateMany).not.toHaveBeenCalled();
        });

        it('upgrades an existing account role without touching its password or name', async () => {
            db.invitation.findUnique.mockResolvedValue(validInvitation);
            db.user.findUnique.mockResolvedValue(mockUser());
            encryption.match.mockResolvedValue(true);
            db.invitation.updateMany.mockResolvedValue({ count: 1 });
            db.user.update.mockResolvedValue(mockUser({ role: Role.MERCHANT }));

            await service.acceptInvitation({
                token: 'signed-token',
                name: 'Different Name',
                password: 'Secret123!',
            });

            const { data } = db.user.update.mock.calls[0][0];
            expect(data.role).toBe(Role.MERCHANT);
            expect(data).not.toHaveProperty('passwordHash');
            expect(data).not.toHaveProperty('name');
            expect(db.user.upsert).not.toHaveBeenCalled();
        });

        it('never downgrades an existing ADMIN', async () => {
            db.invitation.findUnique.mockResolvedValue(validInvitation);
            db.user.findUnique.mockResolvedValue(
                mockUser({ role: Role.ADMIN })
            );
            encryption.match.mockResolvedValue(true);
            db.invitation.updateMany.mockResolvedValue({ count: 1 });
            db.user.update.mockResolvedValue(mockUser({ role: Role.ADMIN }));

            await service.acceptInvitation({
                token: 'signed-token',
                name: 'Admin',
                password: 'Secret123!',
            });

            expect(db.user.update.mock.calls[0][0].data.role).toBe(Role.ADMIN);
        });
    });
});
