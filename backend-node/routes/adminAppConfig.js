const express = require("express");
const AppConfig = require("../models/AppConfig");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(requireAdmin);

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

const ALLOWED = ["latestVersion", "minSupportedVersion", "updateMessage", "androidStoreUrl", "iosStoreUrl", "promoTitle", "promoCode", "promoNote"];

router.patch("/", async (req, res) => {
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  try {
    const config = await AppConfig.findOneAndUpdate(
      { key: "app-config" },
      { $set: updates, $setOnInsert: { key: "app-config" } },
      { upsert: true, new: true }
    ).lean();
    res.json(config);
  } catch (err) {
    res.status(503).json({ error: "Could not update app version info" });
  }
});

module.exports = router;
