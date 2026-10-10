import { IoredisCacheClient } from 'src/common/cache/clients/ioredis-cache.client';
import { UpstashCacheClient } from 'src/common/cache/clients/upstash-cache.client';
import { INCR_WITH_TTL_SCRIPT } from 'src/common/cache/constants/cache.constant';
import { CacheService } from 'src/common/cache/services/cache.service';

const ioredisEval = jest.fn();
jest.mock('ioredis', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({ eval: ioredisEval })),
}));

const upstashEval = jest.fn();
jest.mock('@upstash/redis', () => ({
    Redis: jest.fn().mockImplementation(() => ({ eval: upstashEval })),
}));

describe('atomic counter: incrWithTtl', () => {
    beforeEach(() => jest.clearAllMocks());

    it('the script INCRs, then sets the TTL whenever the key has none, in one EVAL', () => {
        // One server-side script: no window between INCR and EXPIRE.
        expect(INCR_WITH_TTL_SCRIPT).toContain("redis.call('INCR', KEYS[1])");
        expect(INCR_WITH_TTL_SCRIPT).toContain("redis.call('TTL', KEYS[1]) < 0");
        expect(INCR_WITH_TTL_SCRIPT).toContain(
            "redis.call('EXPIRE', KEYS[1], ARGV[1])"
        );
    });

    it('ioredis client sends one EVAL with 1 key and the TTL', async () => {
        ioredisEval.mockResolvedValue(3);
        const client = new IoredisCacheClient('redis://localhost:6379');
        await expect(client.incrWithTtl('login-attempts:a@b.c', 900)).resolves.toBe(3);
        expect(ioredisEval).toHaveBeenCalledTimes(1);
        expect(ioredisEval).toHaveBeenCalledWith(
            INCR_WITH_TTL_SCRIPT,
            1,
            'login-attempts:a@b.c',
            900
        );
    });

    it('Upstash client sends one EVAL with keys/args arrays and returns a number', async () => {
        upstashEval.mockResolvedValue('2');
        const client = new UpstashCacheClient('https://x.upstash.io', 'token');
        await expect(client.incrWithTtl('forgot-attempts:a@b.c', 900)).resolves.toBe(2);
        expect(upstashEval).toHaveBeenCalledTimes(1);
        expect(upstashEval).toHaveBeenCalledWith(
            INCR_WITH_TTL_SCRIPT,
            ['forgot-attempts:a@b.c'],
            [900]
        );
    });

    it('CacheService delegates and clamps the TTL to a whole number ≥ 1 (EXPIRE 0 would delete the key)', async () => {
        const client = { incrWithTtl: jest.fn().mockResolvedValue(1) };
        const cache = new CacheService(client as never);
        await cache.incrWithTtl('k', 900);
        await cache.incrWithTtl('k', 0);
        await cache.incrWithTtl('k', -5);
        await cache.incrWithTtl('k', 1.2);
        expect(client.incrWithTtl.mock.calls).toEqual([
            ['k', 900],
            ['k', 1],
            ['k', 1],
            ['k', 2],
        ]);
    });
});
