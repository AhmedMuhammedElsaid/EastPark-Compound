import { registerAs } from '@nestjs/config';

export default registerAs('redis', (): Record<string, any> => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    return {
        url: redisUrl,
        restUrl: process.env.UPSTASH_REDIS_REST_URL,
        restToken: process.env.UPSTASH_REDIS_REST_TOKEN,
        tls: redisUrl.startsWith('rediss://') ? {} : null,
    };
});
