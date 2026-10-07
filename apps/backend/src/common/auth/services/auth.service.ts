import { randomBytes } from 'node:crypto';

import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    HttpException,
    HttpStatus,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResidentLead, ResidentLeadStatus, Role, User } from '@prisma/client';

import { CacheService } from '../../cache/services/cache.service';
import {
    isPrismaError,
    PRISMA_UNIQUE_VIOLATION,
} from '../../database/prisma-errors';
import { DatabaseService } from '../../database/services/database.service';
import { EmailService } from '../../email/email.service';
import { IRefreshTokenPayload } from '../../helper/interfaces/encryption.interface';
import { HelperEncryptionService } from '../../helper/services/helper.encryption.service';
import { normalizeEmail } from '../../helper/transforms/normalize-email.transform';
import { formatUnitLabel } from '../../helper/utils/unit-label';
import { IAuthUser } from '../../request/interfaces/request.interface';
import {
    AcceptInvitationDto,
    AuthForgotPasswordDto,
    AuthLoginDto,
    AuthResetPasswordDto,
    PASSWORD_MSG,
    PASSWORD_REGEX,
} from '../dtos/request/auth.dto';
import {
    AuthRefreshResponseDto,
    AuthResponseDto,
} from '../dtos/response/auth.response.dto';

import { SessionVersionService } from './session-version.service';

const RESET_TTL = 1800; // 30 minutes
const LOGIN_MAX_FAILURES = 10; // failed logins per email per window
const LOGIN_FAILURE_WINDOW = 900; // 15 minutes
const FORGOT_MAX_REQUESTS = 3; // reset mails per email per window
const FORGOT_REQUEST_WINDOW = 900; // 15 minutes
const FORGOT_PASSWORD_MESSAGE =
    'If that email exists, a reset link has been sent';

/** Privilege order used so an invitation can upgrade but never downgrade. */
const ROLE_RANK: Record<Role, number> = {
    [Role.GUEST]: -1,
    [Role.RESIDENT]: 0,
    [Role.MERCHANT]: 1,
    [Role.ADMIN]: 2,
    [Role.SUPER_ADMIN]: 3,
};

/** Canonical `User.unitNumber` built from a resident lead's unit fields. */
export function formatLeadUnit(
    lead: Pick<ResidentLead, 'building' | 'floor' | 'flatNumber'>
): string {
    return formatUnitLabel(lead);
}

@Injectable()
export class AuthService {
    private readonly appUrl: string;
    private dummyHash?: Promise<string>;

    constructor(
        private readonly db: DatabaseService,
        private readonly cache: CacheService,
        private readonly email: EmailService,
        private readonly encryption: HelperEncryptionService,
        private readonly config: ConfigService,
        private readonly sessions: SessionVersionService
    ) {
        this.appUrl =
            config.get<string>('app.webUrl') ?? 'http://localhost:3000';
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    async login(dto: AuthLoginDto): Promise<AuthResponseDto> {
        const email = normalizeEmail(dto.email);

        // Per-email cap that holds across client IPs. Counted before the
        // password check (atomic INCR) and for unknown
        // emails too, so the 429 does not reveal which emails exist.
        const attemptsKey = this.loginAttemptsKey(email);
        const attempts = await this.cache.incr(attemptsKey);
        if (attempts === 1)
            await this.cache.expire(attemptsKey, LOGIN_FAILURE_WINDOW);
        if (attempts > LOGIN_MAX_FAILURES) {
            throw new HttpException(
                'Too many login attempts — try again later',
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        const user = await this.db.user.findUnique({ where: { email } });
        if (!user || user.deletedAt) {
            // Same status, message and (roughly) timing as a wrong password,
            // so login cannot be used to enumerate registered emails. A
            // soft-deleted account answers exactly like an unknown one.
            await this.encryption.match(
                await this.getDummyHash(),
                dto.password
            );
            throw new UnauthorizedException('Invalid credentials');
        }

        const match = await this.encryption.match(
            user.passwordHash,
            dto.password
        );
        if (!match) throw new UnauthorizedException('Invalid credentials');

        // Correct password: only failures count toward the cap.
        await this.cache.del(attemptsKey);

        // Harmless guard: every account is created verified (invitation flow).
        // Public self-registration and its OTP step were removed.
        if (!user.isVerified)
            throw new ForbiddenException('Please verify your email first');

        return this.buildAuthResponse(user);
    }

    // ── Refresh ───────────────────────────────────────────────────────────────

    /**
     * Rotates the refresh token carried in the `Authorization` header.
     * `payload` is that header token, already verified by JwtRefreshGuard;
     * `rawToken` is its raw string. `bodyToken` is the legacy body field and,
     * when sent, must be the same token.
     */
    async refresh(
        payload: IRefreshTokenPayload,
        rawToken: string,
        bodyToken?: string
    ): Promise<AuthRefreshResponseDto> {
        if (!rawToken) throw new UnauthorizedException('Token revoked');
        if (bodyToken !== undefined && bodyToken !== rawToken)
            throw new UnauthorizedException('Refresh token mismatch');

        const currentVersion = await this.sessions.getCurrent(payload.userId);
        if ((payload.ver ?? 0) < currentVersion)
            throw new UnauthorizedException('Session expired');

        // Single use: the first INCR wins, so a replayed, concurrently reused
        // or logged-out token (value already set) is rejected atomically.
        const revocationKey = this.revocationKey(payload, rawToken);
        const uses = await this.cache.incr(revocationKey);
        if (uses !== 1) throw new UnauthorizedException('Token revoked');
        await this.cache.expire(revocationKey, this.remainingTtl(payload));

        // Never mint from the token payload alone: the account may have been
        // deleted, un-verified or had its role changed since it was issued.
        const user = await this.db.user.findUnique({
            where: { id: payload.userId },
        });
        if (!user || !user.isVerified || user.deletedAt)
            throw new UnauthorizedException('Session expired');

        return this.encryption.createJwtTokens({
            userId: user.id,
            role: user.role,
            ver: currentVersion,
        });
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    /**
     * The `Authorization` header on logout carries the ACCESS token (the route
     * is access-guarded), so the refresh token to revoke comes from the body.
     * It is only revoked when it verifies and belongs to the caller. Without
     * it there is nothing server-side to revoke; the access token expires on
     * its own (15 min).
     */
    async logout(
        actor: IAuthUser,
        rawRefreshToken?: string
    ): Promise<{ message: string }> {
        const message = { message: 'Logged out successfully' };
        if (!rawRefreshToken) return message;

        let payload: IRefreshTokenPayload;
        try {
            payload = await this.encryption.verifyRefreshToken(rawRefreshToken);
        } catch {
            return message; // expired or forged: nothing to revoke
        }
        if (payload.userId !== actor.userId) return message;

        await this.cache.set(
            this.revocationKey(payload, rawRefreshToken),
            '1',
            this.remainingTtl(payload)
        );
        return message;
    }

    // ── Forgot Password ───────────────────────────────────────────────────────

    async forgotPassword(
        dto: AuthForgotPasswordDto
    ): Promise<{ message: string }> {
        const email = normalizeEmail(dto.email);

        // Per-email cap that holds across client IPs. Counted before the DB
        // lookup and for unknown emails too, and an over-cap request gets the
        // exact same response as any other, so neither the status nor the body
        // reveals whether the account exists.
        const attemptsKey = this.forgotAttemptsKey(email);
        const attempts = await this.cache.incr(attemptsKey);
        if (attempts === 1)
            await this.cache.expire(attemptsKey, FORGOT_REQUEST_WINDOW);
        if (attempts > FORGOT_MAX_REQUESTS)
            return { message: FORGOT_PASSWORD_MESSAGE };

        const user = await this.db.user.findUnique({ where: { email } });
        // Always respond with the same message to prevent email enumeration.
        // A soft-deleted account silently gets nothing.
        if (!user || user.deletedAt) return { message: FORGOT_PASSWORD_MESSAGE };

        const token = randomBytes(32).toString('hex');
        await this.cache.set(this.resetKey(token), user.email, RESET_TTL);

        const resetUrl = `${this.appUrl}/auth/reset-password?token=${token}`;
        await this.email.sendPasswordReset(user.email, resetUrl);

        return { message: FORGOT_PASSWORD_MESSAGE };
    }

    // ── Reset Password ────────────────────────────────────────────────────────

    async resetPassword(
        dto: AuthResetPasswordDto
    ): Promise<{ message: string }> {
        // Consume the token atomically (GETDEL): of two concurrent requests
        // carrying the same token only one receives the email, so a reset
        // token can never be used twice.
        const email = await this.cache.getdel<string>(this.resetKey(dto.token));
        if (!email)
            throw new BadRequestException('Reset token expired or invalid');

        // A token mailed before the account was soft-deleted must not work.
        const existing = await this.db.user.findUnique({ where: { email } });
        if (!existing || existing.deletedAt)
            throw new BadRequestException('Reset token expired or invalid');

        const passwordHash = await this.encryption.createHash(dto.password);
        const user = await this.db.user.update({
            where: { email },
            data: { passwordHash },
        });
        // Lift any per-email login lockout: someone who reset because they
        // were locked out must be able to sign in now. The reset-request
        // counter goes too: a successful reset ends the episode.
        await this.cache.del(
            this.loginAttemptsKey(email),
            this.forgotAttemptsKey(email)
        );

        // Invalidate every existing session: access and refresh tokens minted
        // before this point carry a lower version and are rejected.
        await this.sessions.bump(user.id);

        return { message: 'Password reset successfully' };
    }

    // ── Accept Invitation ─────────────────────────────────────────────────────

    /**
     * New email → creates the account with the invited role.
     * Existing account → the invitation never overwrites the password or name.
     * The caller must prove account ownership with the CURRENT password; the
     * role is then upgraded to the invited role, never downgraded.
     * RESIDENT invitations also copy phone/unit from the matching resident
     * lead, record the flat as owned by the account (`resident_units`, 409
     * `unit.error.alreadyOwned` if someone else owns it) and mark that lead
     * CONVERTED.
     */
    async acceptInvitation(dto: AcceptInvitationDto): Promise<AuthResponseDto> {
        const invitation = await this.db.invitation.findUnique({
            where: { token: dto.token },
            include: { invitedBy: { select: { deletedAt: true } } },
        });
        if (!invitation) throw new NotFoundException('Invitation not found');
        if (invitation.usedAt)
            throw new BadRequestException('Invitation already used');
        // A soft-deleted admin's pending invitations stop working (and work
        // again if the SUPER_ADMIN restores the admin).
        if (invitation.expiresAt < new Date() || invitation.invitedBy?.deletedAt)
            throw new BadRequestException('Invitation expired');

        const email = normalizeEmail(invitation.email);
        const existing = await this.db.user.findUnique({ where: { email } });

        // The email of a soft-deleted account stays reserved for it.
        if (existing?.deletedAt)
            throw new ConflictException('user.error.accountDeleted');

        if (!existing && !PASSWORD_REGEX.test(dto.password)) {
            // New account: the strength rules apply. Same body as the DTO
            // validation 400 it replaces (an array message, rendered as
            // `error: [...]`), so clients keep telling it apart from the
            // prose "Invitation already used/expired" 400s. The invitation
            // stays unused.
            throw new BadRequestException([PASSWORD_MSG]);
        }

        if (existing) {
            // Existing account: only the stored hash decides, never today's
            // strength rules.
            const owns = await this.encryption.match(
                existing.passwordHash,
                dto.password
            );
            if (!owns)
                throw new ConflictException(
                    'An account with this email already exists — enter its current password to accept the invitation'
                );
        }

        const leads =
            invitation.role === Role.RESIDENT
                ? await this.findInvitationLeads(email)
                : [];
        const primaryLead = leads[0];
        // Phone: the newest registration, as before.
        const phoneLead = leads[leads.length - 1];

        const passwordHash = existing
            ? undefined
            : await this.encryption.createHash(dto.password);

        const user = await this.db.$transaction(async tx => {
            // Claim the invitation atomically so it cannot be used twice.
            const claimed = await tx.invitation.updateMany({
                where: { id: invitation.id, usedAt: null },
                data: { usedAt: new Date() },
            });
            if (claimed.count === 0)
                throw new BadRequestException('Invitation already used');

            const saved = existing
                ? await tx.user.update({
                      where: { id: existing.id },
                      data: {
                          role:
                              ROLE_RANK[invitation.role] >
                              ROLE_RANK[existing.role]
                                  ? invitation.role
                                  : existing.role,
                          isVerified: true,
                          ...(phoneLead && !existing.phone
                              ? { phone: phoneLead.phone }
                              : {}),
                          ...(primaryLead && !existing.unitNumber
                              ? { unitNumber: formatLeadUnit(primaryLead) }
                              : {}),
                      },
                  })
                : await tx.user.create({
                      data: {
                          name: dto.name.trim(),
                          email,
                          passwordHash: passwordHash as string,
                          role: invitation.role,
                          isVerified: true,
                          ...(primaryLead && phoneLead
                              ? {
                                    phone: phoneLead.phone,
                                    unitNumber: formatLeadUnit(primaryLead),
                                }
                              : {}),
                      },
                  });

            for (const lead of leads) {
                // The flat becomes owned by this account. Another owner of ANY
                // of the flats (unique flat key) rolls the whole claim back:
                // the invitation stays unused.
                try {
                    await tx.residentUnit.create({
                        data: {
                            userId: saved.id,
                            building: lead.building,
                            floor: lead.floor,
                            flatNumber: lead.flatNumber,
                            leadId: lead.id,
                        },
                    });
                } catch (error) {
                    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION))
                        throw new ConflictException('unit.error.alreadyOwned');
                    throw error;
                }

                await tx.residentLead.update({
                    where: { id: lead.id },
                    data: {
                        userId: saved.id,
                        status: ResidentLeadStatus.CONVERTED,
                    },
                });
            }

            return saved;
        });

        return this.buildAuthResponse(user);
    }

    /**
     * Leads a RESIDENT invitation attaches. Every INVITED lead for the email
     * (one person can register several flats), oldest first: the oldest is the
     * primary when the account has none yet. With no INVITED lead (e.g. an
     * admin's manual RESIDENT invitation), the newest PENDING lead, as before.
     */
    private async findInvitationLeads(email: string): Promise<ResidentLead[]> {
        const invited = await this.db.residentLead.findMany({
            where: { email, status: ResidentLeadStatus.INVITED },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        if (invited.length > 0) return invited;

        const pending = await this.db.residentLead.findFirst({
            where: { email, status: ResidentLeadStatus.PENDING },
            orderBy: { createdAt: 'desc' },
        });
        return pending ? [pending] : [];
    }

    // ── Push Token ────────────────────────────────────────────────────────────

    /**
     * A push token identifies a device, not a person. When another account
     * signs in on the same phone, detach the token from the previous owner
     * so their order/feedback pushes stop reaching the new user.
     */
    async updatePushToken(userId: string, pushToken: string): Promise<void> {
        await this.db.$transaction([
            this.db.user.updateMany({
                where: { pushToken, id: { not: userId } },
                data: { pushToken: null },
            }),
            this.db.user.update({
                where: { id: userId },
                data: { pushToken },
            }),
        ]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private async buildAuthResponse(user: User): Promise<AuthResponseDto> {
        const tokens = await this.encryption.createJwtTokens({
            userId: user.id,
            role: user.role,
            ver: await this.sessions.getCurrent(user.id),
        });
        const { passwordHash: _h, pushToken: _p, ...safeUser } = user;
        return { ...tokens, user: safeUser };
    }

    private getDummyHash(): Promise<string> {
        this.dummyHash ??= this.encryption.createHash(
            randomBytes(16).toString('hex')
        );
        return this.dummyHash;
    }

    /** Seconds until the refresh token expires (falls back to full TTL). */
    private remainingTtl(payload: IRefreshTokenPayload): number {
        if (payload.exp) {
            const remaining = payload.exp - Math.floor(Date.now() / 1000);
            if (remaining > 0) return remaining;
            return 1;
        }
        return this.parseExpiry(
            this.config.get<string>('auth.refreshToken.tokenExp') ?? '7d'
        );
    }

    private loginAttemptsKey(email: string): string {
        return `login-attempts:${email}`;
    }

    private forgotAttemptsKey(email: string): string {
        return `forgot-attempts:${email}`;
    }

    private resetKey(token: string): string {
        return `reset:${token}`;
    }

    /** Tokens minted before `jti` existed fall back to the raw token. */
    private revocationKey(
        payload: IRefreshTokenPayload,
        rawToken: string
    ): string {
        return payload.jti
            ? `blacklist:jti:${payload.jti}`
            : `blacklist:${rawToken}`;
    }

    private parseExpiry(exp: string): number {
        const unit = exp.slice(-1);
        const value = parseInt(exp.slice(0, -1), 10);
        switch (unit) {
            case 's':
                return value;
            case 'm':
                return value * 60;
            case 'h':
                return value * 3600;
            case 'd':
                return value * 86400;
            default:
                return 7 * 86400;
        }
    }
}
