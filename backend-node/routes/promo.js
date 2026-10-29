const express = require("express");
const AppConfig = require("../models/AppConfig");

const router = express.Router();

// GET /api/promo — public banner text; {} when no offer is set.
router.get("/", async (req, res) => {
  try {
    const c = await AppConfig.findOne({ key: "app-config" }).select("promoTitle promoCode promoNote").lean();
    if (!c || !c.promoTitle) return res.json({});
    res.json({ title: c.promoTitle, code: c.promoCode || "", note: c.promoNote || "" });
  } catch (err) {
    res.json({});
  }
});

module.exports = router;
