import { Logger } from '@nestjs/common';

import authConfig, {
    AUTH_SECRET_MIN_LENGTH,
    authSecretProblems,
} from 'src/common/config/auth.config';

const KEYS = [
    'APP_ENV',
    'AUTH_ACCESS_TOKEN_SECRET',
    'AUTH_REFRESH_TOKEN_SECRET',
] as const;
const original = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));

const strong = (c: string) => c.repeat(AUTH_SECRET_MIN_LENGTH);

describe('authConfig secret checks', () => {
    beforeEach(() => {
        for (const k of KEYS) delete process.env[k];
    });

    afterEach(() => {
        jest.restoreAllMocks();
        for (const k of KEYS) {
            if (original[k] === undefined) delete process.env[k];
            else process.env[k] = original[k];
        }
    });

    it('accepts two distinct strong secrets', () => {
        process.env.AUTH_ACCESS_TOKEN_SECRET = strong('a');
        process.env.AUTH_REFRESH_TOKEN_SECRET = strong('b');

        expect(authConfig()).toMatchObject({
            accessToken: { secret: strong('a') },
            refreshToken: { secret: strong('b') },
        });
    });

    it('refuses to boot outside production when the secrets are equal', () => {
        process.env.APP_ENV = 'local';
        process.env.AUTH_ACCESS_TOKEN_SECRET = strong('a');
        process.env.AUTH_REFRESH_TOKEN_SECRET = strong('a');

        expect(() => authConfig()).toThrow(
            'AUTH_ACCESS_TOKEN_SECRET and AUTH_REFRESH_TOKEN_SECRET must differ'
        );
    });

    it('refuses to boot outside production when a secret is too short', () => {
        process.env.APP_ENV = 'staging';
        process.env.AUTH_ACCESS_TOKEN_SECRET = 'short';
        process.env.AUTH_REFRESH_TOKEN_SECRET = strong('b');

        expect(() => authConfig()).toThrow(
            `AUTH_ACCESS_TOKEN_SECRET must be at least ${AUTH_SECRET_MIN_LENGTH} characters`
        );
    });

    it('only logs loudly in production (never bricks a live deploy)', () => {
        const error = jest
            .spyOn(Logger.prototype, 'error')
            .mockImplementation(() => undefined);
        process.env.APP_ENV = 'production';
        process.env.AUTH_ACCESS_TOKEN_SECRET = strong('a');
        process.env.AUTH_REFRESH_TOKEN_SECRET = strong('a');

        expect(() => authConfig()).not.toThrow();
        expect(error).toHaveBeenCalledWith(
            expect.stringContaining('must differ')
        );
    });

    it('leaves missing secrets to getOrThrow at the call sites', () => {
        expect(authSecretProblems(undefined, undefined)).toEqual([]);
        expect(() => authConfig()).not.toThrow();
    });
});
