const express = require("express");
const { createRateLimiter } = require("../services/rateLimitStore");
const { getDistance } = require("../services/googleMaps");

const router = express.Router();

// This can hit a metered external API, so it gets its own tighter limit
// than general reads — bursty typing/autocomplete is expected, but this
// caps the worst case cost of abuse. Cache hits (see services/googleMaps.js)
// don't re-call Google at all, so normal usage rarely gets close to this.
const distanceLimiter = createRateLimiter({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/distance  { origin, destination }
router.post("/", distanceLimiter, async (req, res) => {
  const { origin, destination } = req.body || {};
  if (!origin || !destination) {
    return res.status(400).json({ error: "origin and destination are required" });
  }

  try {
    const { distanceKm, durationText, source } = await getDistance(origin, destination);
    res.json({ distanceKm, durationText, source });
  } catch (err) {
    if (err.code === "NOT_CONFIGURED") {
      // Not an error the rider should ever see — the form just falls
      // back to manual distance entry silently.
      return res.status(503).json({ error: "Distance calculation not configured", code: err.code });
    }
    res.status(422).json({ error: err.message, code: err.code || "UNKNOWN" });
  }
});

module.exports = router;
