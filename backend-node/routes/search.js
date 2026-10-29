const express = require("express");
const { createRateLimiter } = require("../services/rateLimitStore");
const Route = require("../models/Route");

const router = express.Router();

// Search is the endpoint most exposed to bursty, sometimes automated
// traffic (autocomplete fires on every keystroke). Cap it separately from
// the rest of the API so a search spike can't starve booking writes.
const searchLimiter = createRateLimiter({
  windowMs: 60_000,
  limit: 120, // per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/routes/search?q=chandigarh&page=1&limit=20
router.get("/search", searchLimiter, async (req, res) => {
  const q = (req.query.q || "").trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  try {
    const filter = q ? { $text: { $search: q } } : {};

    const [results, total] = await Promise.all([
      Route.find(filter)
        .read("secondaryPreferred") // read traffic → replicas
        .sort(q ? { score: { $meta: "textScore" } } : { from: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Route.countDocuments(filter),
    ]);

    res.json({ results, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(503).json({ error: "Route search unavailable" });
  }
});

// GET /api/routes/:from/:to — exact-match lookup, uses the compound index
router.get("/:from/:to", async (req, res) => {
  try {
    const route = await Route.findOne({
      from: new RegExp(`^${req.params.from}$`, "i"),
      to: new RegExp(`^${req.params.to}$`, "i"),
    })
      .read("secondaryPreferred")
      .lean();

    if (!route) return res.status(404).json({ error: "Route not found" });
    res.json(route);
  } catch (err) {
    res.status(503).json({ error: "Route lookup unavailable" });
  }
});

module.exports = router;
