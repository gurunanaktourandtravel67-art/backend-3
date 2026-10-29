const express = require("express");
const Route = require("../models/Route");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(requireAdmin);

router.get("/", async (req, res) => {
  try {
    const routes = await Route.find().sort({ from: 1, to: 1 }).lean();
    res.json(routes);
  } catch (err) {
    res.status(503).json({ error: "Routes unavailable" });
  }
});

// POST /api/admin/routes  { from, to, km, hours, fare }
// Upserts on (from, to) — matches the unique compound index on Route, so
// adding a route that already exists just updates it instead of erroring.
router.post("/", async (req, res) => {
  const { from, to, km, hours, fare } = req.body || {};
  if (!from || !to || km == null || !hours || fare == null) {
    return res.status(400).json({ error: "from, to, km, hours and fare are required" });
  }

  try {
    const route = await Route.findOneAndUpdate(
      { from, to },
      { $set: { km, hours, fare } },
      { upsert: true, new: true }
    );
    res.status(201).json(route);
  } catch (err) {
    res.status(503).json({ error: "Could not save route" });
  }
});

// PATCH /api/admin/routes/:id
// { fare: 3200 }        — set an absolute price
// { fareDelta: -50 }    — nudge the current price up/down (never below 0)
router.patch("/:id", async (req, res) => {
  const { fare, fareDelta, km, hours } = req.body || {};
  if (fare == null && fareDelta == null && km == null && hours == null) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  try {
    const route = await Route.findById(req.params.id);
    if (!route) return res.status(404).json({ error: "Route not found" });

    if (fare != null) route.fare = Math.max(0, fare);
    if (fareDelta != null) route.fare = Math.max(0, route.fare + fareDelta);
    if (km != null) route.km = km;
    if (hours != null) route.hours = hours;

    await route.save();
    res.json(route);
  } catch (err) {
    res.status(400).json({ error: "Invalid route id or update failed" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const route = await Route.findByIdAndDelete(req.params.id).lean();
    if (!route) return res.status(404).json({ error: "Route not found" });
    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: "Invalid route id" });
  }
});

module.exports = router;
