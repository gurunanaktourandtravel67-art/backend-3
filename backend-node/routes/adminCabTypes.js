const express = require("express");
const CabType = require("../models/CabType");
const { requireAdmin } = require("../middleware/auth");
const { invalidateCabTypeCache } = require("../services/cabTypeCache");

const router = express.Router();

router.use(requireAdmin);

router.get("/", async (req, res) => {
  try {
    const cabTypes = await CabType.find().sort({ baseFare: 1 }).lean();
    res.json(cabTypes);
  } catch (err) {
    res.status(503).json({ error: "Cab type lookup unavailable" });
  }
});

// PATCH /api/admin/cabtypes/:id
// { baseFare, perKm, baseKm, label, example, seats } — any subset.
// This is the actual "meter rate": these three numbers feed directly into
// the Java fare engine on every quote (see routes/fare.js), not just the
// displayed fleet card, so an edit here changes real charged fares
// immediately — the cache is invalidated below rather than left to expire.
router.patch("/:id", async (req, res) => {
  const allowed = ["baseFare", "perKm", "baseKm", "label", "example", "seats", "discountPercent"];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.discountPercent !== undefined) {
    const d = Number(updates.discountPercent);
    if (!Number.isFinite(d) || d < 0 || d > 60) return res.status(400).json({ error: "Discount must be between 0 and 60" });
    updates.discountPercent = Math.round(d);
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  try {
    const cabType = await CabType.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
    if (!cabType) return res.status(404).json({ error: "Cab type not found" });
    await invalidateCabTypeCache();
    res.json(cabType);
  } catch (err) {
    res.status(400).json({ error: "Invalid cab type id or update failed" });
  }
});

module.exports = router;
