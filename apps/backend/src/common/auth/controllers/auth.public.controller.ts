import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

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

@ApiTags('auth')
@Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 req/min — stricter than global 100/min
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
    @PublicRoute()
    @UseGuards(JwtRefreshGuard)
    @ApiBearerAuth('refreshToken')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Exchange a valid refresh token for a new token pair',
    })
    refresh(
        @AuthUser() user: IAuthUser,
        @Body() dto: AuthLogoutDto
    ): Promise<AuthRefreshResponseDto> {
        return this.authService.refresh(user, dto.refreshToken);
    }

    @Post('logout')
    @UseGuards(JwtAccessGuard)
    @ApiBearerAuth('accessToken')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Revoke refresh token (blacklist)' })
    logout(@Body() dto: AuthLogoutDto): Promise<{ message: string }> {
        return this.authService.logout(dto.refreshToken);
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
