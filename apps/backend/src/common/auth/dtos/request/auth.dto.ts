import { ApiProperty } from '@nestjs/swagger';
import {
    IsEmail,
    IsNotEmpty,
    IsPhoneNumber,
    IsString,
    Length,
    Matches,
} from 'class-validator';

const PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[\x21-\x7E]{8,}$/;
const PASSWORD_MSG =
    'Password must be 8+ chars with uppercase, lowercase, number, and special character';

// ── Register ──────────────────────────────────────────────────────────────────

export class AuthRegisterDto {
    @ApiProperty({ example: 'Ahmed Hassan' })
    @IsString()
    @IsNotEmpty()
    @Length(2, 100)
    name: string;

    @ApiProperty({ example: 'ahmed@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: '+201234567890' })
    @IsPhoneNumber()
    @IsNotEmpty()
    phone: string;

    @ApiProperty({ example: 'A1-301' })
    @IsString()
    @IsNotEmpty()
    unitNumber: string;

    @ApiProperty({ example: 'Passw0rd!', description: PASSWORD_MSG })
    @IsString()
    @IsNotEmpty()
    @Matches(PASSWORD_REGEX, { message: PASSWORD_MSG })
    password: string;
}

// ── Verify OTP ────────────────────────────────────────────────────────────────

export class AuthVerifyOtpDto {
    @ApiProperty({ example: 'ahmed@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: '482910' })
    @IsString()
    @IsNotEmpty()
    @Length(6, 6)
    otp: string;
}

// ── Resend OTP ────────────────────────────────────────────────────────────────

export class AuthResendOtpDto {
    @ApiProperty({ example: 'ahmed@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;
}

// ── Login ─────────────────────────────────────────────────────────────────────

export class AuthLoginDto {
    @ApiProperty({ example: 'ahmed@example.com' })
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

    @ApiProperty({ example: 'Passw0rd!', description: PASSWORD_MSG })
    @IsString()
    @IsNotEmpty()
    @Matches(PASSWORD_REGEX, { message: PASSWORD_MSG })
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

export class AuthLogoutDto {
    @ApiProperty({ example: 'eyJhbGciOi...' })
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}
