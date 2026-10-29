const express = require("express");
const GalleryPhoto = require("../models/GalleryPhoto");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(requireAdmin);

// Admin sees everything, including photos toggled off the public gallery.
router.get("/", async (req, res) => {
  try {
    const photos = await GalleryPhoto.find().sort({ order: 1, createdAt: -1 }).lean();
    res.json(photos);
  } catch (err) {
    res.status(503).json({ error: "Gallery unavailable" });
  }
});

router.post("/", async (req, res) => {
  const { imageUrl, caption, category, order } = req.body || {};
  if (!imageUrl) {
    return res.status(400).json({ error: "imageUrl is required" });
  }

  try {
    const photo = await GalleryPhoto.create({
      imageUrl,
      caption: caption || "",
      category: category || "",
      order: order != null ? Number(order) : 0,
    });
    res.status(201).json(photo);
  } catch (err) {
    res.status(503).json({ error: "Could not add photo" });
  }
});

// PATCH /api/admin/gallery/:id — partial update; also how the
// active/inactive (show/hide from the public gallery) toggle works.
router.patch("/:id", async (req, res) => {
  const allowed = ["imageUrl", "caption", "category", "order", "active"];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  try {
    const photo = await GalleryPhoto.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
    if (!photo) return res.status(404).json({ error: "Photo not found" });
    res.json(photo);
  } catch (err) {
    res.status(400).json({ error: "Invalid photo id or update failed" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const photo = await GalleryPhoto.findByIdAndDelete(req.params.id).lean();
    if (!photo) return res.status(404).json({ error: "Photo not found" });
    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: "Invalid photo id" });
  }
});

module.exports = router;
