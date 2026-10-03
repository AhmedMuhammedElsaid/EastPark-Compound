import { Redis } from '@upstash/redis';

import { CacheClient } from './cache-client.interface';

export class UpstashCacheClient implements CacheClient {
    private readonly redis: Redis;

    constructor(url: string, token: string) {
        this.redis = new Redis({ url, token });
    }

    close(): Promise<void> {
        return Promise.resolve();
    }

    get(key: string): Promise<unknown> {
        return this.redis.get(key);
    }

    getdel(key: string): Promise<unknown> {
        return this.redis.getdel(key);
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        if (ttlSeconds !== undefined && ttlSeconds > 0) {
            await this.redis.set(key, value, { ex: ttlSeconds });
            return;
        }
        await this.redis.set(key, value);
    }

    async del(...keys: string[]): Promise<void> {
        await this.redis.del(...keys);
    }

    exists(key: string): Promise<number> {
        return this.redis.exists(key);
    }

    keys(pattern: string): Promise<string[]> {
        return this.redis.keys(pattern);
    }

    async hset(key: string, field: string, value: string): Promise<void> {
        await this.redis.hset(key, { [field]: value });
    }

    hget(key: string, field: string): Promise<unknown> {
        return this.redis.hget(key, field);
    }

    hgetall(key: string): Promise<Record<string, unknown> | null> {
        return this.redis.hgetall(key);
    }

    async hdel(key: string, ...fields: string[]): Promise<void> {
        await this.redis.hdel(key, ...fields);
    }

    incr(key: string): Promise<number> {
        return this.redis.incr(key);
    }

    decr(key: string): Promise<number> {
        return this.redis.decr(key);
    }

    async expire(key: string, ttlSeconds: number): Promise<void> {
        await this.redis.expire(key, ttlSeconds);
    }

    ttl(key: string): Promise<number> {
        return this.redis.ttl(key);
    }

    async flush(): Promise<void> {
        await this.redis.flushdb();
    }

    isHealthy(): boolean {
        return true;
    }
}
