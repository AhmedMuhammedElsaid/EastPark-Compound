import { Reflector } from '@nestjs/core';

import { JwtAccessGuard } from 'src/common/request/guards/jwt.access.guard';

const ctx = (authorization?: string) =>
    ({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
            getRequest: () => ({ headers: { authorization } }),
        }),
    }) as any;

describe('JwtAccessGuard optional auth on public routes', () => {
    const reflector = { getAllAndOverride: jest.fn() };
    let guard: JwtAccessGuard;
    let parent: jest.SpyInstance;

    beforeEach(() => {
        reflector.getAllAndOverride.mockReset();
        guard = new JwtAccessGuard(reflector as unknown as Reflector);
        const proto = Object.getPrototypeOf(JwtAccessGuard.prototype);
        parent = jest.spyOn(proto, 'canActivate');
    });
    afterEach(() => parent.mockRestore());

    it('public + no token: passes, passport not invoked', async () => {
        reflector.getAllAndOverride.mockReturnValue(true);
        await expect(guard.canActivate(ctx())).resolves.toBe(true);
        expect(parent).not.toHaveBeenCalled();
    });

    it('public + bearer token: passport invoked to populate user', async () => {
        reflector.getAllAndOverride.mockReturnValue(true);
        parent.mockResolvedValue(true);
        await expect(guard.canActivate(ctx('Bearer abc'))).resolves.toBe(true);
        expect(parent).toHaveBeenCalled();
    });

    it('public + bad token: still passes', async () => {
        reflector.getAllAndOverride.mockReturnValue(true);
        parent.mockRejectedValue(new Error('jwt expired'));
        await expect(guard.canActivate(ctx('Bearer bad'))).resolves.toBe(true);
    });

    it('public handleRequest never throws', () => {
        reflector.getAllAndOverride.mockReturnValue(true);
        expect(guard.handleRequest(null, false, null, ctx())).toBeUndefined();
        const u = { userId: '1' };
        expect(guard.handleRequest(null, u, null, ctx())).toBe(u);
    });

    it('private route: handleRequest throws without user', () => {
        reflector.getAllAndOverride.mockReturnValue(false);
        expect(() => guard.handleRequest(null, false, null, ctx())).toThrow();
    });
});
