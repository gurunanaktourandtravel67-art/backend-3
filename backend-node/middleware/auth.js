const jwt = require("jsonwebtoken");
const { getRedis } = require("../services/redisClient");

// Fail loudly at startup rather than silently signing tokens with a
// fallback secret that anyone reading this source could forge.
if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not set. Add it to backend-node/.env before starting the server."
  );
}

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = "12h";
const TOKEN_TTL_SECONDS = 12 * 60 * 60;

// Revocation list for logged-out tokens. Uses Redis when REDIS_URL is set,
// so a logout on one Node instance actually revokes the token on every
// instance behind a load balancer — the in-memory Set fallback only
// revokes on whichever single instance handled the logout request.
const revokedTokensLocal = new Set();

function signAdminToken(admin) {
  return jwt.sign({ sub: admin._id.toString(), username: admin.username, role: "admin" }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

async function revokeToken(token) {
  const redis = getRedis();
  if (redis) {
    // EX matches the token's max lifetime — no point keeping a revocation
    // entry around after the token itself would've expired anyway.
    await redis.set(`averra:revoked:${token}`, "1", "EX", TOKEN_TTL_SECONDS).catch(() => {
      // Redis unreachable — fall back to local revocation so logout still
      // works on this instance even if it can't propagate to others.
      revokedTokensLocal.add(token);
    });
  } else {
    revokedTokensLocal.add(token);
  }
}

async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  try {
    const redis = getRedis();
    const isRevoked = redis
      ? Boolean(await redis.get(`averra:revoked:${token}`).catch(() => null))
      : revokedTokensLocal.has(token);

    if (isRevoked) {
      return res.status(401).json({ error: "Session has been logged out" });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "admin") throw new Error("Not an admin token");
    req.admin = payload;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session, please log in again" });
  }
}

module.exports = { signAdminToken, requireAdmin, revokeToken, TOKEN_TTL };
