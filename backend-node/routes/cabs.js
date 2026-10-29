const express = require("express");
const { getCabTypes } = require("../services/cabTypeCache");
const { CITIES } = require("../data/cabTypes");

const router = express.Router();

router.get("/cabtypes", async (req, res) => {
  try {
    const cabTypes = await getCabTypes();
    res.json(cabTypes);
  } catch (err) {
    res.status(503).json({ error: "Cab type lookup unavailable" });
  }
});

router.get("/cities", (req, res) => {
  // Small, static enough not to need a DB round trip at all.
  res.json(CITIES);
});

module.exports = router;
