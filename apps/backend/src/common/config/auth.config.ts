import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';

import { APP_ENVIRONMENT } from 'src/app/enums/app.enum';

/** HS256 keys shorter than this are guessable offline from any issued JWT. */
export const AUTH_SECRET_MIN_LENGTH = 32;

/**
 * Problems with the JWT signing secrets, if any. Identical secrets let a
 * 7-day refresh token pass as an access token (both are signed the same way);
 * short secrets can be brute-forced from a captured token.
 */
export function authSecretProblems(
    accessSecret: string | undefined,
    refreshSecret: string | undefined
): string[] {
    const problems: string[] = [];
    if (accessSecret && refreshSecret && accessSecret === refreshSecret) {
        problems.push(
            'AUTH_ACCESS_TOKEN_SECRET and AUTH_REFRESH_TOKEN_SECRET must differ'
        );
    }
    for (const [name, value] of [
        ['AUTH_ACCESS_TOKEN_SECRET', accessSecret],
        ['AUTH_REFRESH_TOKEN_SECRET', refreshSecret],
    ] as const) {
        if (value && value.length < AUTH_SECRET_MIN_LENGTH) {
            problems.push(
                `${name} must be at least ${AUTH_SECRET_MIN_LENGTH} characters`
            );
        }
    }
    return problems;
}

export default registerAs('auth', (): Record<string, any> => {
    const accessSecret = process.env.AUTH_ACCESS_TOKEN_SECRET;
    const refreshSecret = process.env.AUTH_REFRESH_TOKEN_SECRET;

    // Outside production a weak setup refuses to boot. In production it is
    // logged loudly instead: the deployed values cannot be checked from the
    // repository, and the container runs `prisma migrate deploy` BEFORE the
    // app boots, so a crash here would leave a migrated database behind a
    // previous release. Rotate the secrets if this error ever appears.
    const problems = authSecretProblems(accessSecret, refreshSecret);
    if (problems.length > 0) {
        const env = process.env.APP_ENV ?? APP_ENVIRONMENT.LOCAL;
        if (env !== APP_ENVIRONMENT.PRODUCTION) {
            throw new Error(problems.join('; '));
        }
        for (const problem of problems) {
            new Logger('AuthConfig').error(
                `INSECURE JWT CONFIGURATION: ${problem}. Rotate the secrets now.`
            );
        }
    }

    return {
        accessToken: {
            secret: accessSecret,
            tokenExp: process.env.AUTH_ACCESS_TOKEN_EXP,
        },
        refreshToken: {
            secret: refreshSecret,
            tokenExp: process.env.AUTH_REFRESH_TOKEN_EXP,
        },
    };
});
