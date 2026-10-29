const express = require("express");
const Coupon = require("../models/Coupon");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAdmin);

const FIELDS = ["code", "description", "type", "value", "maxDiscount", "minFare", "validFrom", "validTo", "usageLimit", "perUserLimit", "active"];

function pick(body) {
  const o = {};
  for (const k of FIELDS) if (body[k] !== undefined) o[k] = body[k];
  for (const k of ["validFrom", "validTo"]) if (o[k] === "" || o[k] === null) o[k] = undefined;
  return o;
}

function invalid(o) {
  if (o.type !== undefined && !["percent", "flat"].includes(o.type)) return "Type must be percent or flat";
  if (o.value !== undefined) {
    const v = Number(o.value);
    if (!(v >= 1)) return "Value must be at least 1";
    if ((o.type === "percent") && v > 100) return "Percent can't exceed 100";
  }
  return null;
}

router.get("/", async (req, res) => {
  try {
    res.json({ coupons: await Coupon.find().sort({ createdAt: -1 }).lean() });
  } catch (err) {
    res.status(503).json({ error: "Coupons unavailable" });
  }
});

router.post("/", async (req, res) => {
  const o = pick(req.body || {});
  if (!o.code || !o.type || o.value === undefined) return res.status(400).json({ error: "code, type and value are required" });
  const bad = invalid(o);
  if (bad) return res.status(400).json({ error: bad });
  try {
    res.status(201).json(await Coupon.create(o));
  } catch (err) {
    res.status(err.code === 11000 ? 409 : 400).json({ error: err.code === 11000 ? "That code already exists" : "Invalid coupon" });
  }
});

router.patch("/:id", async (req, res) => {
  const o = pick(req.body || {});
  delete o.code; // codes are fixed once created (bookings reference them)
  const existing = await Coupon.findById(req.params.id).lean().catch(() => null);
  if (!existing) return res.status(404).json({ error: "Coupon not found" });
  const bad = invalid({ type: existing.type, ...o });
  if (bad) return res.status(400).json({ error: bad });
  try {
    res.json(await Coupon.findByIdAndUpdate(req.params.id, { $set: o }, { new: true, runValidators: true }).lean());
  } catch (err) {
    res.status(400).json({ error: "Update failed" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: "Invalid id" });
  }
});

module.exports = router;
