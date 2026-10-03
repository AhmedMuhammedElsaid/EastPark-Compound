export interface CacheClient {
    close(): Promise<void>;
    get(key: string): Promise<unknown>;
    /** Atomically read and delete a key (Redis GETDEL). */
    getdel(key: string): Promise<unknown>;
    set(key: string, value: string, ttlSeconds?: number): Promise<void>;
    del(...keys: string[]): Promise<void>;
    exists(key: string): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    hset(key: string, field: string, value: string): Promise<void>;
    hget(key: string, field: string): Promise<unknown>;
    hgetall(key: string): Promise<Record<string, unknown> | null>;
    hdel(key: string, ...fields: string[]): Promise<void>;
    incr(key: string): Promise<number>;
    decr(key: string): Promise<number>;
    expire(key: string, ttlSeconds: number): Promise<void>;
    ttl(key: string): Promise<number>;
    flush(): Promise<void>;
    isHealthy(): boolean;
}
