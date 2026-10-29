const express = require("express");
const GalleryPhoto = require("../models/GalleryPhoto");

const router = express.Router();

// GET /api/gallery — public, active photos only.
router.get("/", async (req, res) => {
  try {
    const photos = await GalleryPhoto.find({ active: true })
      .sort({ order: 1, createdAt: -1 })
      .read("secondaryPreferred")
      .lean();
    res.json(photos);
  } catch (err) {
    res.status(503).json({ error: "Gallery unavailable" });
  }
});

module.exports = router;
