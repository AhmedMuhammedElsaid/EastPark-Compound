import {
    IAuthTokenResponse,
    IEncryptDataPayload,
    IJwtClaims,
    IRefreshTokenPayload,
} from './encryption.interface';

export interface IHelperEncryptionService {
    createJwtTokens(payload: IJwtClaims): Promise<IAuthTokenResponse>;
    createAccessToken(payload: IJwtClaims): Promise<string>;
    createRefreshToken(payload: IJwtClaims): Promise<string>;
    verifyRefreshToken(token: string): Promise<IRefreshTokenPayload>;
    createHash(password: string): Promise<string>;
    match(hash: string, password: string): Promise<boolean>;
    encrypt(text: string): Promise<IEncryptDataPayload>;
    decrypt(data: IEncryptDataPayload): Promise<string>;
}
