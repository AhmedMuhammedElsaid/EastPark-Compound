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
import { SessionVersionService } from 'src/common/auth/services/session-version.service';
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
        updateMany: jest.fn(),
        upsert: jest.fn(),
    },
    invitation: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    residentLead: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
    },
    residentUnit: {
        create: jest.fn(),
    },
    // Interactive transaction: run the callback against the same mocks.
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(db)),
};

const cache = {
    get: jest.fn(),
    getdel: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
};

const sessions = {
    getCurrent: jest.fn(),
    bump: jest.fn(),
    revokeDeletedUser: jest.fn(),
    assertCurrent: jest.fn(),
};

const email = {
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
        sessions.getCurrent.mockResolvedValue(0);
        sessions.bump.mockResolvedValue(1);
        db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
            fn(db)
        );
        db.residentLead.findMany.mockResolvedValue([]);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: DatabaseService, useValue: db },
                { provide: CacheService, useValue: cache },
                { provide: EmailService, useValue: email },
                { provide: HelperEncryptionService, useValue: encryption },
                { provide: ConfigService, useValue: config },
                { provide: SessionVersionService, useValue: sessions },
            ],
        }).compile();

        service = module.get(AuthService);
    });

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

        it('a soft-deleted account gets the same generic 401 as an unknown email', async () => {
            db.user.findUnique.mockResolvedValue(
                mockUser({ deletedAt: new Date() })
            );
            encryption.match.mockResolvedValue(true);
            const attempt = service.login({
                email: 'jane@eastpark.app',
                password: 'Secret123!',
            });
            await expect(attempt).rejects.toBeInstanceOf(UnauthorizedException);
            await expect(attempt).rejects.toThrow('Invalid credentials');
            // The real hash is never compared, only the dummy one.
            expect(encryption.match).not.toHaveBeenCalledWith(
                '$argon2hash',
                expect.anything()
            );
            expect(encryption.createJwtTokens).not.toHaveBeenCalled();
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

        it('rejects when the account was soft-deleted', async () => {
            db.user.findUnique.mockResolvedValue(
                mockUser({ deletedAt: new Date() })
            );
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
            sessions.getCurrent.mockResolvedValue(1);
            await expect(
                service.refresh({ ...payload, ver: 0 }, 'header.token')
            ).rejects.toThrow('Session expired');
            expect(cache.incr).not.toHaveBeenCalled();
        });

        it('accepts tokens carrying the current session version', async () => {
            sessions.getCurrent.mockResolvedValue(1);
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

    // ── resetPassword ─────────────────────────────────────────────────────────

    describe('resetPassword', () => {
        beforeEach(() => {
            db.user.findUnique.mockResolvedValue(mockUser());
        });

        it('rejects a token mailed before the account was soft-deleted', async () => {
            cache.getdel.mockResolvedValue('jane@eastpark.app');
            db.user.findUnique.mockResolvedValue(
                mockUser({ deletedAt: new Date() })
            );

            await expect(
                service.resetPassword({ token: 't', password: 'NewPass1!' })
            ).rejects.toBeInstanceOf(BadRequestException);
            expect(db.user.update).not.toHaveBeenCalled();
            expect(sessions.bump).not.toHaveBeenCalled();
        });

        it('updates the hash and bumps the session version', async () => {
            cache.getdel.mockResolvedValue('jane@eastpark.app');
            db.user.update.mockResolvedValue(mockUser());

            await service.resetPassword({ token: 't', password: 'NewPass1!' });

            expect(db.user.update).toHaveBeenCalledWith({
                where: { email: 'jane@eastpark.app' },
                data: { passwordHash: '$hash' },
            });
            expect(sessions.bump).toHaveBeenCalledWith('user-1');
        });

        it('consumes the token atomically and clears the login lockout for that email', async () => {
            cache.getdel.mockResolvedValue('jane@eastpark.app');
            db.user.update.mockResolvedValue(mockUser());

            await service.resetPassword({ token: 't', password: 'NewPass1!' });

            expect(cache.getdel).toHaveBeenCalledWith('reset:t');
            expect(cache.get).not.toHaveBeenCalled();
            expect(cache.del).toHaveBeenCalledWith(
                'login-attempts:jane@eastpark.app',
                'forgot-attempts:jane@eastpark.app'
            );
        });

        it('rejects an unknown or already-used token without touching the user', async () => {
            cache.getdel.mockResolvedValue(null);

            await expect(
                service.resetPassword({ token: 't', password: 'NewPass1!' })
            ).rejects.toBeInstanceOf(BadRequestException);
            expect(db.user.update).not.toHaveBeenCalled();
            expect(sessions.bump).not.toHaveBeenCalled();
        });

        it('lets exactly one of two concurrent requests with the same token succeed', async () => {
            // Redis GETDEL hands the value to the first caller only.
            cache.getdel
                .mockResolvedValueOnce('jane@eastpark.app')
                .mockResolvedValueOnce(null);
            db.user.update.mockResolvedValue(mockUser());

            const results = await Promise.allSettled([
                service.resetPassword({ token: 't', password: 'NewPass1!' }),
                service.resetPassword({ token: 't', password: 'Other1!x' }),
            ]);

            expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(
                1
            );
            const rejected = results.filter(
                (r): r is PromiseRejectedResult => r.status === 'rejected'
            );
            expect(rejected).toHaveLength(1);
            expect(rejected[0]!.reason).toBeInstanceOf(BadRequestException);
            expect(db.user.update).toHaveBeenCalledTimes(1);
            expect(sessions.bump).toHaveBeenCalledTimes(1);
        });
    });

    // ── forgotPassword ────────────────────────────────────────────────────────

    describe('forgotPassword', () => {
        const MESSAGE = 'If that email exists, a reset link has been sent';

        beforeEach(() => {
            cache.incr.mockResolvedValue(1);
        });

        it('returns the same message when user does not exist (no email enumeration)', async () => {
            db.user.findUnique.mockResolvedValue(null);

            const result = await service.forgotPassword({
                email: 'noone@eastpark.app',
            });

            expect(email.sendPasswordReset).not.toHaveBeenCalled();
            expect(result.message).toMatch(/if that email/i);
        });

        it('a soft-deleted account silently gets no reset email', async () => {
            db.user.findUnique.mockResolvedValue(
                mockUser({ deletedAt: new Date() })
            );
            await expect(
                service.forgotPassword({ email: 'jane@eastpark.app' })
            ).resolves.toEqual({ message: MESSAGE });
            expect(cache.set).not.toHaveBeenCalled();
            expect(email.sendPasswordReset).not.toHaveBeenCalled();
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

        it('counts the first request per email and starts the 15 minute window', async () => {
            db.user.findUnique.mockResolvedValue(mockUser());
            cache.set.mockResolvedValue(undefined);
            email.sendPasswordReset.mockResolvedValue(undefined);

            await service.forgotPassword({ email: 'Jane@EastPark.app' });

            expect(cache.incr).toHaveBeenCalledWith(
                'forgot-attempts:jane@eastpark.app'
            );
            expect(cache.expire).toHaveBeenCalledWith(
                'forgot-attempts:jane@eastpark.app',
                900
            );
            expect(email.sendPasswordReset).toHaveBeenCalledTimes(1);
        });

        it('over the cap: same message, no lookup, no email', async () => {
            cache.incr.mockResolvedValue(4);

            const result = await service.forgotPassword({
                email: 'jane@eastpark.app',
            });

            expect(result).toEqual({ message: MESSAGE });
            expect(db.user.findUnique).not.toHaveBeenCalled();
            expect(email.sendPasswordReset).not.toHaveBeenCalled();
        });

        it('over the cap for an unknown email is indistinguishable from under the cap', async () => {
            db.user.findUnique.mockResolvedValue(null);
            cache.incr.mockResolvedValue(1);
            const underCap = await service.forgotPassword({
                email: 'noone@eastpark.app',
            });

            cache.incr.mockResolvedValue(4);
            const overCap = await service.forgotPassword({
                email: 'noone@eastpark.app',
            });

            expect(overCap).toEqual(underCap);
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

        it('409 accountDeleted when the email belongs to a soft-deleted account', async () => {
            db.invitation.findUnique.mockResolvedValue(validInvitation);
            db.user.findUnique.mockResolvedValue(
                mockUser({
                    email: 'merchant@eastpark.app',
                    deletedAt: new Date(),
                })
            );
            encryption.match.mockResolvedValue(true);
            const attempt = service.acceptInvitation({
                token: 'signed-token',
                name: 'Ali',
                password: 'Pass123!',
            });
            await expect(attempt).rejects.toBeInstanceOf(ConflictException);
            await expect(attempt).rejects.toThrow('user.error.accountDeleted');
            expect(db.invitation.updateMany).not.toHaveBeenCalled();
            expect(db.user.update).not.toHaveBeenCalled();
            expect(db.user.create).not.toHaveBeenCalled();
        });

        it("refuses an invitation sent by an admin who was soft-deleted", async () => {
            db.invitation.findUnique.mockResolvedValue({
                ...validInvitation,
                invitedBy: { deletedAt: new Date() },
            });
            await expect(
                service.acceptInvitation({
                    token: 'signed-token',
                    name: 'Ali',
                    password: 'Pass123!',
                })
            ).rejects.toThrow('Invitation expired');
            expect(db.invitation.updateMany).not.toHaveBeenCalled();
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
            db.residentLead.findMany.mockResolvedValue([
                {
                    id: 'lead-1',
                    phone: '01000400163',
                    building: 'A1',
                    floor: '3',
                    flatNumber: '12',
                },
            ]);
            db.invitation.updateMany.mockResolvedValue({ count: 1 });
            db.user.create.mockResolvedValue(
                mockUser({ id: 'user-9', email: 'resident@eastpark.app' })
            );

            await service.acceptInvitation({
                token: 'signed-token',
                name: 'Resident',
                password: 'Pass123!',
            });

            expect(db.residentLead.findMany).toHaveBeenCalledWith({
                where: { email: 'resident@eastpark.app', status: 'INVITED' },
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            });
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
            // The flat becomes owned by the new account (self, no addedBy).
            expect(db.residentUnit.create).toHaveBeenCalledWith({
                data: {
                    userId: 'user-9',
                    building: 'A1',
                    floor: '3',
                    flatNumber: '12',
                    leadId: 'lead-1',
                },
            });
        });

        it('existing account accepting a RESIDENT invitation with a lead: owns the flat, unitNumber kept', async () => {
            db.invitation.findUnique.mockResolvedValue({
                ...validInvitation,
                role: Role.RESIDENT,
            });
            db.user.findUnique.mockResolvedValue(
                mockUser({ unitNumber: 'B1-2-1', phone: '01000400111' })
            );
            encryption.match.mockResolvedValue(true);
            db.residentLead.findMany.mockResolvedValue([
                {
                    id: 'lead-2',
                    phone: '01000400163',
                    building: 'A1',
                    floor: '3',
                    flatNumber: '4',
                },
            ]);
            db.invitation.updateMany.mockResolvedValue({ count: 1 });
            db.user.update.mockResolvedValue(mockUser());

            await service.acceptInvitation({
                token: 'signed-token',
                name: 'Ali',
                password: 'Pass123!',
            });

            const updateData = db.user.update.mock.calls[0][0].data;
            expect(updateData.unitNumber).toBeUndefined();
            expect(db.residentUnit.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: mockUser().id,
                    building: 'A1',
                    floor: '3',
                    flatNumber: '4',
                    leadId: 'lead-2',
                }),
            });
            expect(db.residentLead.update).toHaveBeenCalledWith({
                where: { id: 'lead-2' },
                data: { userId: mockUser().id, status: 'CONVERTED' },
            });
        });

        it('maps a flat unique violation to 409 unit.error.alreadyOwned and leaves the lead untouched', async () => {
            db.invitation.findUnique.mockResolvedValue({
                ...validInvitation,
                role: Role.RESIDENT,
            });
            db.user.findUnique.mockResolvedValue(null);
            db.residentLead.findMany.mockResolvedValue([
                {
                    id: 'lead-1',
                    phone: '01000400163',
                    building: 'A1',
                    floor: '3',
                    flatNumber: '12',
                },
                {
                    id: 'lead-2',
                    phone: '01000400163',
                    building: 'B2',
                    floor: 'G',
                    flatNumber: '5',
                },
            ]);
            db.invitation.updateMany.mockResolvedValue({ count: 1 });
            db.user.create.mockResolvedValue(mockUser({ id: 'user-9' }));
            // The FIRST flat is fine, the second one is owned by someone else.
            db.residentUnit.create
                .mockResolvedValueOnce({})
                .mockRejectedValueOnce({ code: 'P2002' });

            const attempt = service.acceptInvitation({
                token: 'signed-token',
                name: 'Resident',
                password: 'Pass123!',
            });
            await expect(attempt).rejects.toBeInstanceOf(ConflictException);
            await expect(attempt).rejects.toThrow('unit.error.alreadyOwned');
            // The whole transaction rolls back (the claim and the first flat
            // included): the error escapes $transaction, no tokens are issued.
            expect(db.residentUnit.create).toHaveBeenCalledTimes(2);
            expect(db.$transaction).toHaveBeenCalledTimes(1);
            expect(encryption.createJwtTokens).not.toHaveBeenCalled();
        });

        it('does not create a flat for a non-RESIDENT invitation', async () => {
            db.invitation.findUnique.mockResolvedValue(validInvitation);
            db.user.findUnique.mockResolvedValue(null);
            db.invitation.updateMany.mockResolvedValue({ count: 1 });
            db.user.create.mockResolvedValue(mockUser({ role: Role.MERCHANT }));

            await service.acceptInvitation({
                token: 'signed-token',
                name: 'Merchant',
                password: 'Pass123!',
            });

            expect(db.residentLead.findMany).not.toHaveBeenCalled();
            expect(db.residentUnit.create).not.toHaveBeenCalled();
        });

        it('no INVITED lead: falls back to the newest PENDING lead (manual RESIDENT invitation)', async () => {
            db.invitation.findUnique.mockResolvedValue({
                ...validInvitation,
                role: Role.RESIDENT,
            });
            db.user.findUnique.mockResolvedValue(null);
            db.residentLead.findMany.mockResolvedValue([]);
            db.residentLead.findFirst.mockResolvedValue({
                id: 'lead-p',
                phone: '01000400333',
                building: 'C1',
                floor: '4',
                flatNumber: '1',
            });
            db.invitation.updateMany.mockResolvedValue({ count: 1 });
            db.user.create.mockResolvedValue(mockUser({ id: 'user-9' }));

            await service.acceptInvitation({
                token: 'signed-token',
                name: 'Resident',
                password: 'Pass123!',
            });

            expect(db.residentLead.findFirst).toHaveBeenCalledWith({
                where: { email: validInvitation.email, status: 'PENDING' },
                orderBy: { createdAt: 'desc' },
            });
            expect(db.user.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    phone: '01000400333',
                    unitNumber: 'C1-4-1',
                }),
            });
            expect(db.residentUnit.create).toHaveBeenCalledWith({
                data: {
                    userId: 'user-9',
                    building: 'C1',
                    floor: '4',
                    flatNumber: '1',
                    leadId: 'lead-p',
                },
            });
            expect(db.residentLead.update).toHaveBeenCalledWith({
                where: { id: 'lead-p' },
                data: { userId: 'user-9', status: 'CONVERTED' },
            });
        });

        it('INVITED leads present: PENDING leads are never looked up', async () => {
            db.invitation.findUnique.mockResolvedValue({
                ...validInvitation,
                role: Role.RESIDENT,
            });
            db.user.findUnique.mockResolvedValue(null);
            db.residentLead.findMany.mockResolvedValue([
                {
                    id: 'lead-i',
                    phone: '01000400111',
                    building: 'A1',
                    floor: '3',
                    flatNumber: '2',
                },
            ]);
            db.invitation.updateMany.mockResolvedValue({ count: 1 });
            db.user.create.mockResolvedValue(mockUser({ id: 'user-9' }));

            await service.acceptInvitation({
                token: 'signed-token',
                name: 'Resident',
                password: 'Pass123!',
            });

            expect(db.residentLead.findFirst).not.toHaveBeenCalled();
            expect(db.residentUnit.create).toHaveBeenCalledTimes(1);
        });

        it('attaches EVERY INVITED lead: one flat each, all CONVERTED, primary = oldest, phone = newest', async () => {
            db.invitation.findUnique.mockResolvedValue({
                ...validInvitation,
                role: Role.RESIDENT,
            });
            db.user.findUnique.mockResolvedValue(null);
            db.residentLead.findMany.mockResolvedValue([
                {
                    id: 'lead-old',
                    phone: '01000400111',
                    building: 'A1',
                    floor: '3',
                    flatNumber: '2',
                },
                {
                    id: 'lead-new',
                    phone: '01000400222',
                    building: 'B2',
                    floor: 'G',
                    flatNumber: '5',
                },
            ]);
            db.invitation.updateMany.mockResolvedValue({ count: 1 });
            db.user.create.mockResolvedValue(mockUser({ id: 'user-9' }));

            await service.acceptInvitation({
                token: 'signed-token',
                name: 'Resident',
                password: 'Pass123!',
            });

            expect(db.user.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    unitNumber: 'A1-3-2',
                    phone: '01000400222',
                }),
            });
            expect(db.residentUnit.create.mock.calls.map(c => c[0].data)).toEqual([
                {
                    userId: 'user-9',
                    building: 'A1',
                    floor: '3',
                    flatNumber: '2',
                    leadId: 'lead-old',
                },
                {
                    userId: 'user-9',
                    building: 'B2',
                    floor: 'G',
                    flatNumber: '5',
                    leadId: 'lead-new',
                },
            ]);
            expect(db.residentLead.update.mock.calls.map(c => c[0])).toEqual([
                {
                    where: { id: 'lead-old' },
                    data: { userId: 'user-9', status: 'CONVERTED' },
                },
                {
                    where: { id: 'lead-new' },
                    data: { userId: 'user-9', status: 'CONVERTED' },
                },
            ]);
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

    describe('updatePushToken', () => {
        it('detaches the token from any other account, then assigns it', async () => {
            db.$transaction.mockImplementation((ops: unknown) =>
                Promise.all(ops as Promise<unknown>[])
            );
            db.user.updateMany.mockResolvedValue({ count: 1 });
            db.user.update.mockResolvedValue(mockUser());

            await service.updatePushToken('user-2', 'ExponentPushToken[abc]');

            expect(db.user.updateMany).toHaveBeenCalledWith({
                where: {
                    pushToken: 'ExponentPushToken[abc]',
                    id: { not: 'user-2' },
                },
                data: { pushToken: null },
            });
            expect(db.user.update).toHaveBeenCalledWith({
                where: { id: 'user-2' },
                data: { pushToken: 'ExponentPushToken[abc]' },
            });
            expect(db.$transaction).toHaveBeenCalledTimes(1);
        });
    });
});
