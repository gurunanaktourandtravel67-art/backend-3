const express = require("express");
const { createRateLimiter } = require("../services/rateLimitStore");
const Booking = require("../models/Booking");
const { CAB_TYPES } = require("../data/cabTypes");
const { withPublicDriver } = require("../services/driverInfo");
const { notifyDriversOfTrip } = require("../services/driverDispatch");
const { notifyAdmins } = require("../services/adminNotify");
const { getFareQuote } = require("../services/fareQuote");
const { checkCoupon, redeem, release, CouponError } = require("../services/coupons");

const router = express.Router();

// Booking creation is the write path that actually matters for revenue —
// limit it more gently than search, but still enough to blunt a retry-storm
// or scripted abuse from taking the DB down with everyone else.
const bookingLimiter = createRateLimiter({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const MOBILE_PATTERN = /^[+]?[0-9\s-]{7,15}$/;

router.post("/", bookingLimiter, async (req, res) => {
  const {
    tripType,
    customerName,
    mobileNumber,
    pickupAddress,
    from,
    to,
    date,
    cabTypeId,
    distanceKm,
    estimatedFare,
    couponCode,
    deviceToken,
  } = req.body || {};

  if (!customerName || !mobileNumber || !pickupAddress || !from || !to || !date || !cabTypeId) {
    return res.status(400).json({
      error:
        "customerName, mobileNumber, pickupAddress, from, to, date and cabTypeId are required",
    });
  }
  if (!MOBILE_PATTERN.test(mobileNumber)) {
    return res.status(400).json({ error: "mobileNumber doesn't look like a valid phone number" });
  }
  if (!CAB_TYPES.some((c) => c.id === cabTypeId)) {
    return res.status(400).json({ error: `Unknown cabTypeId: ${cabTypeId}` });
  }

  // Coupon: the fare is recomputed on the server, so a rider can't send a
  // made-up fare or discount. The redemption is taken atomically and
  // handed back if the booking itself fails to save.
  let fare = { estimatedFare };
  let redeemed = null;
  if (couponCode && String(couponCode).trim()) {
    try {
      const quote = await getFareQuote(cabTypeId, Number(distanceKm) || 0, tripType);
      if (!quote) return res.status(400).json({ error: `Unknown cabTypeId: ${cabTypeId}` });
      const { coupon, discount, finalFare } = await checkCoupon(couponCode, quote.total, mobileNumber);
      await redeem(coupon);
      redeemed = coupon;
      fare = { estimatedFare: finalFare, couponCode: coupon.code, discountAmount: discount, fareBeforeDiscount: quote.total };
    } catch (err) {
      if (err instanceof CouponError) return res.status(422).json({ error: err.message });
      return res.status(503).json({ error: "Coupon check unavailable, please retry" });
    }
  }

  try {
    const booking = await Booking.create({
      tripType,
      customerName,
      mobileNumber,
      pickupAddress,
      from,
      to,
      date,
      cabTypeId,
      distanceKm,
      ...fare,
      deviceToken, // optional — omitted entirely by web bookings, that's fine
    });
    notifyDriversOfTrip(booking);
    notifyAdmins({
      title: "New booking",
      body: `${booking.customerName}: ${booking.from} → ${booking.to}` +
        (booking.estimatedFare != null ? ` · ₹${Math.round(booking.estimatedFare)}` : ""),
      data: { type: "new_booking", bookingId: String(booking._id) },
      ring: true,
    });
    const { claimedByDriverId, driverAssignmentStatus, ...pub } = booking.toObject();
    res.status(201).json(pub);
  } catch (err) {
    if (redeemed) await release(redeemed);
    res.status(503).json({ error: "Booking service unavailable, please retry" });
  }
});

// GET /api/bookings?mobileNumber=...&status=&page=&limit=
// mobileNumber is required here — without auth, letting this endpoint list
// every booking would hand out every customer's name, phone and pickup
// address to anyone who asks. A rider can look up their own bookings by
// the number they booked with; a full, unrestricted listing lives at
// GET /api/admin/bookings, behind admin login.
router.get("/", async (req, res) => {
  if (!req.query.mobileNumber) {
    return res.status(400).json({ error: "mobileNumber is required to look up bookings" });
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = { mobileNumber: req.query.mobileNumber }; // uses the {mobileNumber, createdAt} index
  if (req.query.status) filter.status = req.query.status;

  try {
    const [results, total] = await Promise.all([
      Booking.find(filter)
        .select("-deviceToken")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter),
    ]);
    res.json({ results: await withPublicDriver(results), page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(503).json({ error: "Booking lookup unavailable" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).select("-deviceToken").lean();
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json(await withPublicDriver(booking));
  } catch (err) {
    res.status(400).json({ error: "Invalid booking id" });
  }
});

module.exports = router;
