import {
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';

import {
    SESSION_VERSION_MEMO_TTL_MS,
    SessionVersionService,
} from 'src/common/auth/services/session-version.service';
import { CacheService } from 'src/common/cache/services/cache.service';

describe('SessionVersionService', () => {
    const cache = {
        get: jest.fn(),
        incr: jest.fn(),
        expire: jest.fn(),
    };
    let service: SessionVersionService;
    let now: number;

    beforeEach(() => {
        jest.clearAllMocks();
        now = 1_000_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        cache.get.mockResolvedValue(null);
        cache.expire.mockResolvedValue(undefined);
        service = new SessionVersionService(cache as unknown as CacheService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('treats an absent key as version 0', async () => {
        await expect(service.getCurrent('u1')).resolves.toBe(0);
        expect(cache.get).toHaveBeenCalledWith('session-version:u1');
    });

    it('treats a non-numeric value as version 0', async () => {
        cache.get.mockResolvedValue('garbage');
        await expect(service.getCurrent('u1')).resolves.toBe(0);
    });

    it('memoises a read for 5 s, then reads Redis again', async () => {
        cache.get.mockResolvedValue('2');
        await expect(service.getCurrent('u1')).resolves.toBe(2);
        now += SESSION_VERSION_MEMO_TTL_MS - 1;
        await expect(service.getCurrent('u1')).resolves.toBe(2);
        expect(cache.get).toHaveBeenCalledTimes(1);

        cache.get.mockResolvedValue('3');
        now += 1;
        await expect(service.getCurrent('u1')).resolves.toBe(3);
        expect(cache.get).toHaveBeenCalledTimes(2);
    });

    it('bump returns the INCR value and overwrites the memo', async () => {
        await service.getCurrent('u1'); // memo holds 0
        cache.incr.mockResolvedValue(4);
        await expect(service.bump('u1')).resolves.toBe(4);
        expect(cache.incr).toHaveBeenCalledWith('session-version:u1');
        await expect(service.getCurrent('u1')).resolves.toBe(4);
        expect(cache.get).toHaveBeenCalledTimes(1);
    });

    describe('assertCurrent', () => {
        it('accepts a legacy token (no ver) while the version is 0', async () => {
            await expect(
                service.assertCurrent({ userId: 'u1' })
            ).resolves.toBeUndefined();
        });

        it('rejects a token older than the current version', async () => {
            cache.get.mockResolvedValue('1');
            await expect(
                service.assertCurrent({ userId: 'u1', ver: 0 })
            ).rejects.toBeInstanceOf(UnauthorizedException);
        });

        it('rejects a legacy token once the version was bumped', async () => {
            cache.get.mockResolvedValue('1');
            await expect(
                service.assertCurrent({ userId: 'u1' })
            ).rejects.toThrow('auth.error.sessionRevoked');
        });

        it('accepts a token carrying the current version', async () => {
            cache.get.mockResolvedValue('2');
            await expect(
                service.assertCurrent({ userId: 'u1', ver: 2 })
            ).resolves.toBeUndefined();
        });

        it('fails closed with 503 when Redis is unavailable', async () => {
            cache.get.mockRejectedValue(new Error('ECONNRESET'));
            await expect(
                service.assertCurrent({ userId: 'u1', ver: 0 })
            ).rejects.toBeInstanceOf(ServiceUnavailableException);
        });

        it('does not serve an expired memo entry when Redis fails', async () => {
            await service.getCurrent('u1'); // memo holds 0
            now += SESSION_VERSION_MEMO_TTL_MS;
            cache.get.mockRejectedValue(new Error('ECONNRESET'));
            await expect(service.getCurrent('u1')).rejects.toThrow(
                'auth.error.sessionStoreUnavailable'
            );
        });
    });
});
