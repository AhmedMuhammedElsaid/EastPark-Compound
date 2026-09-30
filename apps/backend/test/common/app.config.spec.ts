import appConfig from 'src/common/config/app.config';

const originalAppEnv = process.env.APP_ENV;
const originalCorsOrigins = process.env.APP_CORS_ORIGINS;

const restoreEnvironmentVariable = (
    key: 'APP_ENV' | 'APP_CORS_ORIGINS',
    value: string | undefined
) => {
    if (value === undefined) {
        delete process.env[key];
        return;
    }

    process.env[key] = value;
};

describe('appConfig', () => {
    beforeEach(() => {
        delete process.env.APP_ENV;
        delete process.env.APP_CORS_ORIGINS;
    });

    afterEach(() => {
        restoreEnvironmentVariable('APP_ENV', originalAppEnv);
        restoreEnvironmentVariable('APP_CORS_ORIGINS', originalCorsOrigins);
    });

    it('rejects a wildcard CORS origin in production', () => {
        process.env.APP_ENV = 'production';
        process.env.APP_CORS_ORIGINS = '*';

        expect(() => appConfig()).toThrow(
            'APP_CORS_ORIGINS must contain explicit origins in production'
        );
    });

    it('rejects missing CORS origins in production', () => {
        process.env.APP_ENV = 'production';

        expect(() => appConfig()).toThrow(
            'APP_CORS_ORIGINS must contain explicit origins in production'
        );
    });

    it('accepts explicit CORS origins in production', () => {
        process.env.APP_ENV = 'production';
        process.env.APP_CORS_ORIGINS =
            'https://eastpark.app, https://admin.eastpark.app';

        expect(appConfig()).toMatchObject({
            cors: {
                origin: ['https://eastpark.app', 'https://admin.eastpark.app'],
            },
        });
    });

    it('allows a wildcard CORS origin locally', () => {
        process.env.APP_ENV = 'local';
        process.env.APP_CORS_ORIGINS = '*';

        expect(appConfig()).toMatchObject({
            cors: {
                origin: true,
            },
        });
    });
});
