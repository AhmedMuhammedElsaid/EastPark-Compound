import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FastifyRequest } from 'fastify';
import { ExtractJwt } from 'passport-jwt';

import { IRefreshTokenPayload } from 'src/common/helper/interfaces/encryption.interface';
import { PublicRoute } from 'src/common/request/decorators/request.public.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { JwtAccessGuard } from 'src/common/request/guards/jwt.access.guard';
import { JwtRefreshGuard } from 'src/common/request/guards/jwt.refresh.guard';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import {
    AcceptInvitationDto,
    AuthForgotPasswordDto,
    AuthLoginDto,
    AuthLogoutDto,
    AuthPushTokenDto,
    AuthRegisterDto,
    AuthResendOtpDto,
    AuthResetPasswordDto,
    AuthVerifyOtpDto,
} from '../dtos/request/auth.dto';
import {
    AuthRefreshResponseDto,
    AuthResponseDto,
} from '../dtos/response/auth.response.dto';
import { AuthService } from '../services/auth.service';

/** Credential-guessing routes: 5 req/min per client IP per route. */
export const AUTH_STRICT_THROTTLE = { default: { limit: 5, ttl: 60000 } };
/**
 * Session-maintenance routes (refresh/logout/push-token) carry a valid token
 * already. Residents behind one compound NAT share an IP, so these get a
 * roomier per-route bucket — a 429 on refresh would force a logout.
 */
export const AUTH_SESSION_THROTTLE = { default: { limit: 60, ttl: 60000 } };

@ApiTags('auth')
@Throttle(AUTH_STRICT_THROTTLE)
@Controller({ version: '1', path: '/auth' })
export class AuthPublicController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    @PublicRoute()
    @ApiOperation({ summary: 'Register a new resident account' })
    register(@Body() dto: AuthRegisterDto): Promise<{ message: string }> {
        return this.authService.register(dto);
    }

    @Post('verify-otp')
    @PublicRoute()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Verify email OTP — returns JWT pair on success' })
    verifyOtp(@Body() dto: AuthVerifyOtpDto): Promise<AuthResponseDto> {
        return this.authService.verifyOtp(dto);
    }

    @Post('resend-otp')
    @PublicRoute()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Resend OTP to email' })
    resendOtp(@Body() dto: AuthResendOtpDto): Promise<{ message: string }> {
        return this.authService.resendOtp(dto);
    }

    @Post('login')
    @PublicRoute()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login with email + password' })
    login(@Body() dto: AuthLoginDto): Promise<AuthResponseDto> {
        return this.authService.login(dto);
    }

    @Post('refresh')
    @Throttle(AUTH_SESSION_THROTTLE)
    @PublicRoute()
    @UseGuards(JwtRefreshGuard)
    @ApiBearerAuth('refreshToken')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Exchange a valid refresh token for a new token pair',
    })
    refresh(
        @AuthUser() payload: IRefreshTokenPayload,
        @Req() req: FastifyRequest,
        @Body() dto: AuthLogoutDto
    ): Promise<AuthRefreshResponseDto> {
        // The header token is the one JwtRefreshGuard verified, so it is the
        // one rotated/revoked. The optional body token must match it.
        const headerToken = ExtractJwt.fromAuthHeaderAsBearerToken()(
            req as never
        );
        return this.authService.refresh(
            payload,
            headerToken ?? '',
            dto.refreshToken
        );
    }

    @Post('logout')
    @Throttle(AUTH_SESSION_THROTTLE)
    @UseGuards(JwtAccessGuard)
    @ApiBearerAuth('accessToken')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Revoke refresh token (blacklist)' })
    logout(
        @AuthUser() user: IAuthUser,
        @Body() dto: AuthLogoutDto
    ): Promise<{ message: string }> {
        return this.authService.logout(user, dto.refreshToken);
    }

    @Post('forgot-password')
    @PublicRoute()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Send password-reset link to email' })
    forgotPassword(
        @Body() dto: AuthForgotPasswordDto
    ): Promise<{ message: string }> {
        return this.authService.forgotPassword(dto);
    }

    @Post('reset-password')
    @PublicRoute()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Set a new password using the reset token' })
    resetPassword(
        @Body() dto: AuthResetPasswordDto
    ): Promise<{ message: string }> {
        return this.authService.resetPassword(dto);
    }

    @Post('accept-invitation')
    @PublicRoute()
    @ApiOperation({
        summary: 'Accept a merchant/admin invitation and create account',
    })
    acceptInvitation(
        @Body() dto: AcceptInvitationDto
    ): Promise<AuthResponseDto> {
        return this.authService.acceptInvitation(dto);
    }

    @Patch('push-token')
    @Throttle(AUTH_SESSION_THROTTLE)
    @UseGuards(JwtAccessGuard)
    @ApiBearerAuth('accessToken')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Register / update Expo push token after login' })
    updatePushToken(
        @AuthUser() { userId }: IAuthUser,
        @Body() dto: AuthPushTokenDto
    ): Promise<void> {
        return this.authService.updatePushToken(userId, dto.pushToken);
    }
}
