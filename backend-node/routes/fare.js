const express = require("express");
const { getFareQuote } = require("../services/fareQuote");

const router = express.Router();

// POST /api/fare/estimate  { cabTypeId, distanceKm, tripType }
// Java owns the pricing rules; the admin-edited rate numbers are sent along
// as overrides (see services/fareQuote.js), with a Node fallback if Java is down.
router.post("/estimate", async (req, res) => {
  const { cabTypeId, distanceKm, tripType } = req.body || {};
  if (!cabTypeId || typeof distanceKm !== "number") {
    return res.status(400).json({ error: "cabTypeId and numeric distanceKm are required" });
  }
  const quote = await getFareQuote(cabTypeId, distanceKm, tripType);
  if (!quote) return res.status(400).json({ error: `Unknown cabTypeId: ${cabTypeId}` });
  res.json(quote);
});

module.exports = router;
