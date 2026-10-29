const Redis = require("ioredis");

// REDIS_URL not set → every caller below falls back to its original
// in-process behavior (a plain Map, an in-memory Set, express-rate-limit's
// default MemoryStore). That's fine for a single Node instance — this
// only actually matters once you run more than one, where in-process
// state doesn't coordinate across instances at all (a rate limit "hit"
// on instance A is invisible to instance B, a cache warmed on A is cold
// on B, a token revoked via A is still valid on B).
let client = null;

function getRedis() {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;

  client = new Redis(url, {
    maxRetriesPerRequest: 2,
    lazyConnect: false,
  });
  client.on("error", (err) => {
    // Don't crash the process over a Redis blip — callers already have
    // in-process fallbacks and should keep working with degraded
    // (per-instance) caching/limiting rather than going down entirely.
    console.error("Redis error:", err.message);
  });
  client.on("connect", () => console.log("Redis connected"));

  return client;
}

module.exports = { getRedis };
