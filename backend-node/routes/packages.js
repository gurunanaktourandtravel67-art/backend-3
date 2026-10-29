const express = require("express");
const Package = require("../models/Package");

const router = express.Router();

// GET /api/packages — public, active packages only, newest first.
router.get("/", async (req, res) => {
  try {
    const packages = await Package.find({ active: true })
      .sort({ createdAt: -1 })
      .read("secondaryPreferred") // read-only, staleness-tolerant — same pattern as /api/routes/search
      .lean();
    res.json(packages);
  } catch (err) {
    res.status(503).json({ error: "Packages unavailable" });
  }
});

module.exports = router;
