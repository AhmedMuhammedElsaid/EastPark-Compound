import { randomBytes, randomInt } from 'node:crypto';

import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

import { CacheService } from '../../cache/services/cache.service';
import { DatabaseService } from '../../database/services/database.service';
import { EmailService } from '../../email/email.service';
import { HelperEncryptionService } from '../../helper/services/helper.encryption.service';
import { IAuthUser } from '../../request/interfaces/request.interface';
import {
    AcceptInvitationDto,
    AuthForgotPasswordDto,
    AuthLoginDto,
    AuthRegisterDto,
    AuthResendOtpDto,
    AuthResetPasswordDto,
    AuthVerifyOtpDto,
} from '../dtos/request/auth.dto';
import {
    AuthRefreshResponseDto,
    AuthResponseDto,
} from '../dtos/response/auth.response.dto';

const OTP_TTL = 600; // 10 minutes
const RESET_TTL = 1800; // 30 minutes
const INVITE_TTL = 48 * 3600; // 48 hours

@Injectable()
export class AuthService {
    private readonly appUrl: string;

    constructor(
        private readonly db: DatabaseService,
        private readonly cache: CacheService,
        private readonly email: EmailService,
        private readonly encryption: HelperEncryptionService,
        private readonly config: ConfigService
    ) {
        this.appUrl = config.get<string>('app.url') ?? 'http://localhost:3000';
    }

    // ── Register ─────────────────────────────────────────────────────────────

    async register(dto: AuthRegisterDto): Promise<{ message: string }> {
        const existing = await this.db.user.findUnique({
            where: { email: dto.email },
        });
        if (existing) throw new ConflictException('Email already registered');

        const passwordHash = await this.encryption.createHash(dto.password);

        await this.db.user.create({
            data: {
                name: dto.name.trim(),
                email: dto.email.toLowerCase(),
                phone: dto.phone,
                unitNumber: dto.unitNumber,
                passwordHash,
                role: Role.RESIDENT,
                isVerified: false,
            },
        });

        await this.sendOtp(dto.email);
        return { message: 'OTP sent to your email' };
    }

    // ── Verify OTP ───────────────────────────────────────────────────────────

    async verifyOtp(dto: AuthVerifyOtpDto): Promise<AuthResponseDto> {
        const stored = await this.cache.get<string>(this.otpKey(dto.email));
        if (!stored) throw new BadRequestException('OTP expired or not found');

        const valid = await this.encryption.match(stored, dto.otp);
        if (!valid) throw new BadRequestException('Invalid OTP');

        await this.cache.del(this.otpKey(dto.email));

        const user = await this.db.user.update({
            where: { email: dto.email },
            data: { isVerified: true },
        });

        const tokens = await this.encryption.createJwtTokens({
            userId: user.id,
            role: user.role,
        });
        const { passwordHash: _h, pushToken: _p, ...safeUser } = user;
        return { ...tokens, user: safeUser };
    }

    // ── Resend OTP ────────────────────────────────────────────────────────────

    async resendOtp(dto: AuthResendOtpDto): Promise<{ message: string }> {
        const user = await this.db.user.findUnique({
            where: { email: dto.email },
        });
        if (!user) throw new NotFoundException('User not found');
        if (user.isVerified)
            throw new BadRequestException('Account already verified');

        await this.cache.del(this.otpKey(dto.email));
        await this.sendOtp(dto.email);
        return { message: 'New OTP sent' };
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    async login(dto: AuthLoginDto): Promise<AuthResponseDto> {
        const user = await this.db.user.findUnique({
            where: { email: dto.email.toLowerCase() },
        });
        if (!user) throw new NotFoundException('User not found');

        const match = await this.encryption.match(
            user.passwordHash,
            dto.password
        );
        if (!match) throw new UnauthorizedException('Invalid credentials');

        if (!user.isVerified)
            throw new ForbiddenException('Please verify your email first');

        const tokens = await this.encryption.createJwtTokens({
            userId: user.id,
            role: user.role,
        });
        const { passwordHash: _h, pushToken: _p, ...safeUser } = user;
        return { ...tokens, user: safeUser };
    }

    // ── Refresh ───────────────────────────────────────────────────────────────

    async refresh(
        payload: IAuthUser,
        rawToken: string
    ): Promise<AuthRefreshResponseDto> {
        const blacklisted = await this.cache.exists(
            this.blacklistKey(rawToken)
        );
        if (blacklisted) throw new UnauthorizedException('Token revoked');

        const tokens = await this.encryption.createJwtTokens({
            userId: payload.userId,
            role: payload.role,
        });

        // Blacklist old token for remaining TTL (≈ refresh expiry)
        const refreshTtl = this.parseExpiry(
            this.config.get<string>('auth.refreshToken.tokenExp') ?? '7d'
        );
        await this.cache.set(this.blacklistKey(rawToken), '1', refreshTtl);

        return tokens;
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    async logout(rawRefreshToken: string): Promise<{ message: string }> {
        const refreshTtl = this.parseExpiry(
            this.config.get<string>('auth.refreshToken.tokenExp') ?? '7d'
        );
        await this.cache.set(
            this.blacklistKey(rawRefreshToken),
            '1',
            refreshTtl
        );
        return { message: 'Logged out successfully' };
    }

    // ── Forgot Password ───────────────────────────────────────────────────────

    async forgotPassword(
        dto: AuthForgotPasswordDto
    ): Promise<{ message: string }> {
        const user = await this.db.user.findUnique({
            where: { email: dto.email.toLowerCase() },
        });
        // Always respond with the same message to prevent email enumeration
        if (!user)
            return {
                message: 'If that email exists, a reset link has been sent',
            };

        const token = randomBytes(32).toString('hex');
        await this.cache.set(this.resetKey(token), user.email, RESET_TTL);

        const resetUrl = `${this.appUrl}/auth/reset-password?token=${token}`;
        await this.email.sendPasswordReset(user.email, resetUrl);

        return { message: 'If that email exists, a reset link has been sent' };
    }

    // ── Reset Password ────────────────────────────────────────────────────────

    async resetPassword(
        dto: AuthResetPasswordDto
    ): Promise<{ message: string }> {
        const email = await this.cache.get<string>(this.resetKey(dto.token));
        if (!email)
            throw new BadRequestException('Reset token expired or invalid');

        const passwordHash = await this.encryption.createHash(dto.password);
        await this.db.user.update({ where: { email }, data: { passwordHash } });
        await this.cache.del(this.resetKey(dto.token));

        return { message: 'Password reset successfully' };
    }

    // ── Accept Invitation (Merchant / Admin) ──────────────────────────────────

    async acceptInvitation(dto: AcceptInvitationDto): Promise<AuthResponseDto> {
        const invitation = await this.db.invitation.findUnique({
            where: { token: dto.token },
        });
        if (!invitation) throw new NotFoundException('Invitation not found');
        if (invitation.usedAt)
            throw new BadRequestException('Invitation already used');
        if (invitation.expiresAt < new Date())
            throw new BadRequestException('Invitation expired');

        const passwordHash = await this.encryption.createHash(dto.password);

        // Upsert user — they might not exist yet
        const user = await this.db.user.upsert({
            where: { email: invitation.email },
            create: {
                name: dto.name.trim(),
                email: invitation.email,
                passwordHash,
                role: invitation.role,
                isVerified: true,
            },
            update: {
                name: dto.name.trim(),
                passwordHash,
                role: invitation.role,
                isVerified: true,
            },
        });

        await this.db.invitation.update({
            where: { id: invitation.id },
            data: { usedAt: new Date() },
        });

        const tokens = await this.encryption.createJwtTokens({
            userId: user.id,
            role: user.role,
        });
        const { passwordHash: _h, pushToken: _p, ...safeUser } = user;
        return { ...tokens, user: safeUser };
    }

    // ── Push Token ────────────────────────────────────────────────────────────

    async updatePushToken(userId: string, pushToken: string): Promise<void> {
        await this.db.user.update({
            where: { id: userId },
            data: { pushToken },
        });
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private async sendOtp(email: string): Promise<void> {
        const otp = String(randomInt(100000, 999999));
        const hash = await this.encryption.createHash(otp);
        await this.cache.set(this.otpKey(email), hash, OTP_TTL);
        await this.email.sendOtp(email, otp);
    }

    private otpKey(email: string): string {
        return `otp:${email}`;
    }

    private resetKey(token: string): string {
        return `reset:${token}`;
    }

    private blacklistKey(token: string): string {
        return `blacklist:${token}`;
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
