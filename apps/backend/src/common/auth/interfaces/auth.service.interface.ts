import { IAuthUser } from 'src/common/request/interfaces/request.interface';

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

export interface IAuthService {
    register(data: AuthRegisterDto): Promise<{ message: string }>;
    verifyOtp(data: AuthVerifyOtpDto): Promise<AuthResponseDto>;
    resendOtp(data: AuthResendOtpDto): Promise<{ message: string }>;
    login(data: AuthLoginDto): Promise<AuthResponseDto>;
    refresh(
        payload: IAuthUser,
        rawToken: string
    ): Promise<AuthRefreshResponseDto>;
    logout(rawRefreshToken: string): Promise<{ message: string }>;
    forgotPassword(data: AuthForgotPasswordDto): Promise<{ message: string }>;
    resetPassword(data: AuthResetPasswordDto): Promise<{ message: string }>;
    acceptInvitation(data: AcceptInvitationDto): Promise<AuthResponseDto>;
    updatePushToken(userId: string, pushToken: string): Promise<void>;
}
