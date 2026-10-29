const express = require("express");
const { createRateLimiter } = require("../services/rateLimitStore");
const { getFareQuote } = require("../services/fareQuote");
const { checkCoupon, CouponError } = require("../services/coupons");

const router = express.Router();

// Tight limit: stops anyone brute-forcing code guesses.
const limiter = createRateLimiter({ windowMs: 60_000, limit: 15, standardHeaders: true, legacyHeaders: false });

// POST /api/coupons/validate { code, cabTypeId, distanceKm, tripType, mobileNumber? }
// The fare is recomputed here on the server — the client never says what the fare is.
router.post("/validate", limiter, async (req, res) => {
  const { code, cabTypeId, distanceKm, tripType, mobileNumber } = req.body || {};
  if (!code || !cabTypeId || typeof distanceKm !== "number") {
    return res.status(400).json({ error: "code, cabTypeId and numeric distanceKm are required" });
  }
  try {
    const quote = await getFareQuote(cabTypeId, distanceKm, tripType);
    if (!quote) return res.status(400).json({ error: `Unknown cabTypeId: ${cabTypeId}` });
    const { coupon, discount, finalFare } = await checkCoupon(code, quote.total, mobileNumber);
    res.json({ code: coupon.code, description: coupon.description, fare: quote.total, discount, finalFare });
  } catch (err) {
    if (err instanceof CouponError) return res.status(422).json({ error: err.message });
    res.status(503).json({ error: "Coupon check unavailable, please try again" });
  }
});

module.exports = router;
