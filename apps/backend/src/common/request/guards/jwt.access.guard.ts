import {
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { PUBLIC_ROUTE_KEY } from '../constants/request.constant';

@Injectable()
export class JwtAccessGuard extends AuthGuard('jwt-access') {
    constructor(private reflector: Reflector) {
        super();
    }

    private isPublicRoute(context: ExecutionContext): boolean {
        return !!this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (this.isPublicRoute(context)) {
            // Optional auth: when a Bearer token is present, try to populate
            // req.user so handlers can personalise responses. A missing,
            // invalid or expired token must never fail a public route.
            const request = context.switchToHttp().getRequest();
            const header: unknown = request?.headers?.authorization;
            if (
                typeof header === 'string' &&
                /^bearer\s+\S+/i.test(header)
            ) {
                try {
                    await super.canActivate(context);
                } catch {
                    // continue as guest
                }
            }
            return true;
        }

        return (await super.canActivate(context)) as boolean;
    }

    handleRequest(
        err: any,
        user: any,
        _info: any,
        context: ExecutionContext,
        _status?: any
    ) {
        if (this.isPublicRoute(context)) {
            return err || !user ? undefined : user;
        }
        if (err || !user) {
            throw (
                err ||
                new UnauthorizedException('auth.error.accessTokenUnauthorized')
            );
        }
        return user;
    }
}
