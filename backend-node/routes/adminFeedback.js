const express = require("express");
const Feedback = require("../models/Feedback");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  const filter = {};
  if (["pending", "approved", "hidden"].includes(req.query.status)) filter.status = req.query.status;
  try {
    const feedback = await Feedback.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ feedback });
  } catch (err) {
    res.status(503).json({ error: "Feedback unavailable" });
  }
});

router.patch("/:id/status", async (req, res) => {
  const { status } = req.body || {};
  if (!["pending", "approved", "hidden"].includes(status)) return res.status(400).json({ error: "Invalid status" });
  try {
    const f = await Feedback.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
    if (!f) return res.status(404).json({ error: "Not found" });
    res.json(f);
  } catch (err) {
    res.status(400).json({ error: "Invalid id" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await Feedback.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: "Invalid id" });
  }
});

module.exports = router;
