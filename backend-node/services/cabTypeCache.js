const CabType = require("../models/CabType");
const { CAB_TYPES: STATIC_CAB_TYPES } = require("../data/cabTypes");
const { getRedis } = require("./redisClient");

// Cab types change rarely, so caching this takes real load off Mongo on
// paths every visitor/booking hits. Uses Redis when REDIS_URL is set (so
// the cache — and its invalidation on admin edits — is shared across every
// Node instance behind a load balancer); falls back to a single
// in-process Map otherwise, which is fine for one instance but means an
// admin's edit only invalidates the instance that handled the request.
const REDIS_KEY = "averra:cabtypes";
const TTL_MS = 60_000;
const TTL_SECONDS = 60;

let localCache = { data: null, expiresAt: 0 };

async function getCabTypes() {
  const redis = getRedis();

  if (redis) {
    try {
      const cached = await redis.get(REDIS_KEY);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      // Redis blip — fall through to Mongo below rather than failing the request.
    }
  } else if (localCache.data && localCache.expiresAt > Date.now()) {
    return localCache.data;
  }

  try {
    // secondaryPreferred: read-only, staleness-tolerant — fine on a replica.
    const cabTypes = await CabType.find().read("secondaryPreferred").lean();
    if (cabTypes.length > 0) {
      if (redis) {
        redis.set(REDIS_KEY, JSON.stringify(cabTypes), "EX", TTL_SECONDS).catch(() => {});
      } else {
        localCache = { data: cabTypes, expiresAt: Date.now() + TTL_MS };
      }
      return cabTypes;
    }
  } catch (err) {
    // fall through to static data below
  }

  // Mongo unreachable or genuinely empty (e.g. seed hasn't run yet) — the
  // static list keeps the site/app functional with the original defaults
  // rather than failing outright. Not cached, so it retries Mongo next call.
  return STATIC_CAB_TYPES;
}

function getCabTypeById(cabTypes, id) {
  return cabTypes.find((c) => c.id === id);
}

/** Called after an admin edit so the new rate is live immediately, not
 * after the cache would otherwise expire — and, with Redis, live on every
 * Node instance at once, not just the one that handled the admin request. */
async function invalidateCabTypeCache() {
  const redis = getRedis();
  if (redis) {
    await redis.del(REDIS_KEY).catch(() => {});
  } else {
    localCache = { data: null, expiresAt: 0 };
  }
}

module.exports = { getCabTypes, getCabTypeById, invalidateCabTypeCache };
