const jwt = require("jsonwebtoken");
const { getRedis } = require("../services/redisClient");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not set.");
const TTL_SECONDS = 30 * 24 * 60 * 60;
const revokedLocal = new Set();

function signDriverToken(driver) {
  return jwt.sign({ sub: driver._id.toString(), role: "driver" }, JWT_SECRET, { expiresIn: "30d" });
}

async function revokeDriverToken(token) {
  const redis = getRedis();
  if (redis) {
    await redis.set(`averra:revoked:${token}`, "1", "EX", TTL_SECONDS).catch(() => revokedLocal.add(token));
  } else {
    revokedLocal.add(token);
  }
}

async function requireDriver(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }
  try {
    const redis = getRedis();
    const revoked = redis
      ? Boolean(await redis.get(`averra:revoked:${token}`).catch(() => null))
      : revokedLocal.has(token);
    if (revoked) return res.status(401).json({ error: "Session has been logged out" });

    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "driver") throw new Error("Not a driver token");
    req.driverId = payload.sub;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session, please log in again" });
  }
}

module.exports = { signDriverToken, requireDriver, revokeDriverToken };
