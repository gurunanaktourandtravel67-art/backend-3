const express = require("express");
const Package = require("../models/Package");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(requireAdmin);

// Admin sees everything, including packages toggled off the public site.
router.get("/", async (req, res) => {
  try {
    const packages = await Package.find().sort({ createdAt: -1 }).lean();
    res.json(packages);
  } catch (err) {
    res.status(503).json({ error: "Packages unavailable" });
  }
});

router.post("/", async (req, res) => {
  const { title, description, imageUrl, price, durationLabel, cities } = req.body || {};
  if (!title || !description || !imageUrl || price == null || !durationLabel) {
    return res
      .status(400)
      .json({ error: "title, description, imageUrl, price and durationLabel are required" });
  }

  try {
    const pkg = await Package.create({ title, description, imageUrl, price, durationLabel, cities });
    res.status(201).json(pkg);
  } catch (err) {
    res.status(503).json({ error: "Could not create package" });
  }
});

// PATCH /api/admin/packages/:id — partial update; also how price changes
// and the active/inactive (show/hide from the public site) toggle work.
router.patch("/:id", async (req, res) => {
  const allowed = ["title", "description", "imageUrl", "price", "durationLabel", "cities", "active"];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  try {
    const pkg = await Package.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
    if (!pkg) return res.status(404).json({ error: "Package not found" });
    res.json(pkg);
  } catch (err) {
    res.status(400).json({ error: "Invalid package id or update failed" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const pkg = await Package.findByIdAndDelete(req.params.id).lean();
    if (!pkg) return res.status(404).json({ error: "Package not found" });
    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: "Invalid package id" });
  }
});

module.exports = router;
