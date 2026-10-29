const express = require("express");
const Feedback = require("../models/Feedback");
const { createRateLimiter } = require("../services/rateLimitStore");

const router = express.Router();

// Anonymous endpoint: tight per-IP limit.
const submitLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });

const clean = (v, max) => String(v == null ? "" : v).replace(/[<>]/g, "").trim().slice(0, max);

// POST /api/feedback { name, rating, comment?, route?, phone?, website? (honeypot) }
router.post("/", submitLimiter, async (req, res) => {
  const b = req.body || {};
  // Honeypot: bots fill hidden fields. Pretend success, store nothing.
  if (b.website) return res.status(201).json({ ok: true });

  const rating = Math.round(Number(b.rating));
  const name = clean(b.name, 60);
  if (!name) return res.status(400).json({ error: "Please enter your name" });
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: "Rating must be 1 to 5 stars" });

  try {
    await Feedback.create({
      name, rating,
      comment: clean(b.comment, 1000),
      route: clean(b.route, 80),
      phone: clean(b.phone, 20),
    });
    res.status(201).json({ ok: true, message: "Thank you! Your feedback will appear after a quick review." });
  } catch (err) {
    res.status(503).json({ error: "Feedback unavailable right now, please try again later" });
  }
});

// GET /api/feedback → approved reviews + overall average (public; no phone).
router.get("/", async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
  try {
    const [reviews, agg] = await Promise.all([
      Feedback.find({ status: "approved" }).sort({ createdAt: -1 }).limit(limit).select("name rating comment route createdAt").lean(),
      Feedback.aggregate([{ $match: { status: "approved" } }, { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }]),
    ]);
    res.json({
      reviews,
      average: agg[0] ? Math.round(agg[0].avg * 10) / 10 : 0,
      count: agg[0] ? agg[0].count : 0,
    });
  } catch (err) {
    res.json({ reviews: [], average: 0, count: 0 });
  }
});

module.exports = router;
