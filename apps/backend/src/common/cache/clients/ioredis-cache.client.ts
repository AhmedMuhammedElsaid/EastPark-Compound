import Redis from 'ioredis';

import { INCR_WITH_TTL_SCRIPT } from '../constants/cache.constant';
import { CacheClient } from './cache-client.interface';

export class IoredisCacheClient implements CacheClient {
    private readonly redis: Redis;

    constructor(url: string) {
        this.redis = new Redis(url);
    }

    async close(): Promise<void> {
        await this.redis.quit();
    }

    get(key: string): Promise<string | null> {
        return this.redis.get(key);
    }

    getdel(key: string): Promise<string | null> {
        return this.redis.getdel(key);
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        if (ttlSeconds !== undefined && ttlSeconds > 0) {
            await this.redis.set(key, value, 'EX', ttlSeconds);
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
        await this.redis.hset(key, field, value);
    }

    hget(key: string, field: string): Promise<string | null> {
        return this.redis.hget(key, field);
    }

    hgetall(key: string): Promise<Record<string, string>> {
        return this.redis.hgetall(key);
    }

    async hdel(key: string, ...fields: string[]): Promise<void> {
        await this.redis.hdel(key, ...fields);
    }

    incr(key: string): Promise<number> {
        return this.redis.incr(key);
    }

    async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
        return Number(await this.redis.eval(INCR_WITH_TTL_SCRIPT, 1, key, ttlSeconds));
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
        return this.redis.status === 'ready';
    }
}
