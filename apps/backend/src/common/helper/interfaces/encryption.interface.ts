import { IAuthUser } from 'src/common/request/interfaces/request.interface';

export interface IEncryptDataPayload {
    iv: string;
    data: string;
    tag: string;
    salt: string;
}

export interface IAuthTokenResponse {
    accessToken: string;
    refreshToken: string;
}

/** Claims signed into access/refresh tokens. `ver` is the per-user session version. */
export interface IJwtClaims extends IAuthUser {
    ver?: number;
}

/** Decoded refresh token as produced by `createRefreshToken`. */
export interface IRefreshTokenPayload extends IJwtClaims {
    jti?: string;
    iat?: number;
    exp?: number;
}
