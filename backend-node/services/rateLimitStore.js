const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { getRedis } = require("./redisClient");

/**
 * Same as calling rateLimit(options) directly, except the store is backed
 * by Redis when REDIS_URL is set. Without Redis, each Node instance
 * enforces limits independently — a rider hitting instance A and instance
 * B alternately could get roughly double the intended limit. With Redis,
 * every instance shares one counter, so the limit means what it says
 * regardless of how many instances are running.
 */
function createRateLimiter(options) {
  const redis = getRedis();
  if (!redis) return rateLimit(options);

  return rateLimit({
    ...options,
    store: new RedisStore({
      sendCommand: (...args) => redis.call(...args),
    }),
  });
}

module.exports = { createRateLimiter };
