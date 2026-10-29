const express = require("express");
const AppConfig = require("../models/AppConfig");

const router = express.Router();

// GET /api/app-version — public, no auth needed (the app calls this
// before the user has done anything). Creates the default doc on first
// call so there's always something sensible to return.
router.get("/", async (req, res) => {
  try {
    const config = await AppConfig.findOneAndUpdate(
      { key: "app-config" },
      { $setOnInsert: { key: "app-config" } },
      { upsert: true, new: true }
    ).lean();
    res.json(config);
  } catch (err) {
    res.status(503).json({ error: "App version info unavailable" });
  }
});

module.exports = router;
