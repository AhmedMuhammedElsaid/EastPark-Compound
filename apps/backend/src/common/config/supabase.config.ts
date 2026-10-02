import { registerAs } from '@nestjs/config';

export default registerAs(
    'supabase',
    (): Record<string, unknown> => ({
        // docker-compose publishes MinIO's S3 API on host port 9002 (→ 9000).
        url: process.env.SUPABASE_URL ?? 'http://localhost:9002',
        // No `?? ''` fallback — see paymob.config.ts. getOrThrow() must be
        // able to actually fire when the secret is missing.
        serviceKey: process.env.SUPABASE_SERVICE_KEY,
        bucket: process.env.SUPABASE_BUCKET ?? 'eastpark-uploads',
    })
);
