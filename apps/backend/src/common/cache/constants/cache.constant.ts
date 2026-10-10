export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * INCR a counter and make sure it carries a TTL, in one atomic server-side
 * step (KEYS[1] = counter, ARGV[1] = TTL seconds). The TTL is set whenever the
 * key has none (not only when the count is 1), so a key left without a TTL by
 * an older INCR-then-EXPIRE sequence heals on its next increment instead of
 * locking its owner out forever. An existing TTL is never extended (fixed
 * window).
 */
export const INCR_WITH_TTL_SCRIPT = `
local n = redis.call('INCR', KEYS[1])
if redis.call('TTL', KEYS[1]) < 0 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return n
`;

