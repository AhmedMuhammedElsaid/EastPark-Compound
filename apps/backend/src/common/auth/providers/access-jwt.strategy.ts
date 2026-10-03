import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { IJwtClaims } from 'src/common/helper/interfaces/encryption.interface';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { SessionVersionService } from '../services/session-version.service';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
    Strategy,
    'jwt-access'
) {
    constructor(
        private readonly configService: ConfigService,
        private readonly sessions: SessionVersionService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow<string>(
                'auth.accessToken.secret'
            ),
        });
    }

    /**
     * Rejects access tokens issued before the user's session version was
     * bumped (password reset, account deletion). A throw here surfaces through
     * JwtAccessGuard.handleRequest as 401/503; on @Public routes the guard
     * swallows it and the request continues as a guest.
     */
    async validate(payload: IJwtClaims): Promise<IAuthUser> {
        await this.sessions.assertCurrent(payload);
        return { userId: payload.userId, role: payload.role };
    }
}
