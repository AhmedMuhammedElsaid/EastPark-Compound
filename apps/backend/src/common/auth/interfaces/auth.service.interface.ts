import { IRefreshTokenPayload } from 'src/common/helper/interfaces/encryption.interface';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import {
    AcceptInvitationDto,
    AuthForgotPasswordDto,
    AuthLoginDto,
    AuthResetPasswordDto,
} from '../dtos/request/auth.dto';
import {
    AuthRefreshResponseDto,
    AuthResponseDto,
} from '../dtos/response/auth.response.dto';

export interface IAuthService {
    login(data: AuthLoginDto): Promise<AuthResponseDto>;
    refresh(
        payload: IRefreshTokenPayload,
        rawToken: string,
        bodyToken?: string
    ): Promise<AuthRefreshResponseDto>;
    logout(
        actor: IAuthUser,
        rawRefreshToken?: string
    ): Promise<{ message: string }>;
    forgotPassword(data: AuthForgotPasswordDto): Promise<{ message: string }>;
    resetPassword(data: AuthResetPasswordDto): Promise<{ message: string }>;
    acceptInvitation(data: AcceptInvitationDto): Promise<AuthResponseDto>;
    updatePushToken(userId: string, pushToken: string): Promise<void>;
}
