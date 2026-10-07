import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEmail,
    IsNotEmpty,
    IsString,
    Length,
    IsOptional,
    Matches,
    MaxLength,
} from 'class-validator';

import { NormalizeEmail } from 'src/common/helper/transforms/normalize-email.transform';

export const PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[\x21-\x7E]{8,}$/;
export const PASSWORD_MSG =
    'Password must be 8+ chars with uppercase, lowercase, number, and special character';

/** Upper bound for the accept-invitation password field (shape check only). */
export const ACCEPT_INVITATION_PASSWORD_MAX = 256;

// ── Login ─────────────────────────────────────────────────────────────────────

export class AuthLoginDto {
    @ApiProperty({ example: 'ahmed@example.com' })
    @NormalizeEmail()
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'Passw0rd!' })
    @IsString()
    @IsNotEmpty()
    password: string;
}

// ── Forgot Password ───────────────────────────────────────────────────────────

export class AuthForgotPasswordDto {
    @ApiProperty({ example: 'ahmed@example.com' })
    @NormalizeEmail()
    @IsEmail()
    @IsNotEmpty()
    email: string;
}

// ── Reset Password ────────────────────────────────────────────────────────────

export class AuthResetPasswordDto {
    @ApiProperty({ example: 'abc123resettoken' })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiProperty({ example: 'NewPassw0rd!', description: PASSWORD_MSG })
    @IsString()
    @IsNotEmpty()
    @Matches(PASSWORD_REGEX, { message: PASSWORD_MSG })
    password: string;
}

// ── Accept Invitation ─────────────────────────────────────────────────────────

export class AcceptInvitationDto {
    @ApiProperty({ example: 'signed-invite-token' })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiProperty({ example: 'Ahmed Hassan' })
    @IsString()
    @IsNotEmpty()
    @Length(2, 100)
    name: string;

    // Shape only. For an email that already has an account this is its
    // CURRENT password, checked against the stored hash and never against
    // today's strength rules (older passwords may predate them). The service
    // enforces PASSWORD_REGEX only when it creates a new account.
    @ApiProperty({
        example: 'Passw0rd!',
        description: `New account: ${PASSWORD_MSG}. Existing account: its current password.`,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(ACCEPT_INVITATION_PASSWORD_MAX)
    password: string;
}

// ── Push Token ────────────────────────────────────────────────────────────────

export class AuthPushTokenDto {
    @ApiProperty({ example: 'ExponentPushToken[xxxxxx]' })
    @IsString()
    @IsNotEmpty()
    pushToken: string;
}

// ── Logout ────────────────────────────────────────────────────────────────────

// Refresh: the `Authorization: Bearer <refresh>` header is authoritative. The
// body field is accepted for backwards compatibility; when present it must equal
// the header token. Logout: the header carries the ACCESS token, so the refresh
// token to revoke comes from this body field.
export class AuthLogoutDto {
    @ApiPropertyOptional({ example: 'eyJhbGciOi...' })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    refreshToken?: string;
}
