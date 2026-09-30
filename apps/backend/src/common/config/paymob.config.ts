import { registerAs } from '@nestjs/config';

export default registerAs(
    'paymob',
    (): Record<string, unknown> => ({
        // No `?? ''` fallbacks: ConfigService.getOrThrow() only throws on
        // undefined, so an empty-string default silently disables the guard
        // and the app boots with blank credentials, failing at the first
        // API call instead of at startup.
        apiKey:        process.env.PAYMOB_API_KEY,
        hmacSecret:    process.env.PAYMOB_HMAC_SECRET,
        integrationId: process.env.PAYMOB_INTEGRATION_ID,
        iframeId:      process.env.PAYMOB_IFRAME_ID,
    })
);
