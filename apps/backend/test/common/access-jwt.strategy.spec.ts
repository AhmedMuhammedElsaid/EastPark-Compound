import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

import { JwtAccessStrategy } from 'src/common/auth/providers/access-jwt.strategy';
import { SessionVersionService } from 'src/common/auth/services/session-version.service';

describe('JwtAccessStrategy', () => {
    const config = { getOrThrow: jest.fn(() => 'secret') };
    const sessions = { assertCurrent: jest.fn() };
    const strategy = new JwtAccessStrategy(
        config as unknown as ConfigService,
        sessions as unknown as SessionVersionService
    );

    beforeEach(() => jest.clearAllMocks());

    it('rejects a token issued before the session version was bumped', async () => {
        sessions.assertCurrent.mockRejectedValue(
            new UnauthorizedException('auth.error.sessionRevoked')
        );
        await expect(
            strategy.validate({ userId: 'u1', role: Role.RESIDENT, ver: 0 })
        ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns only userId and role for a current token', async () => {
        sessions.assertCurrent.mockResolvedValue(undefined);
        const payload = {
            userId: 'u1',
            role: Role.ADMIN,
            ver: 3,
            iat: 1,
            exp: 2,
        };
        await expect(strategy.validate(payload)).resolves.toEqual({
            userId: 'u1',
            role: Role.ADMIN,
        });
        expect(sessions.assertCurrent).toHaveBeenCalledWith(payload);
    });
});
