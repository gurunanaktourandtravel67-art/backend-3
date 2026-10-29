const express = require("express");
const Booking = require("../models/Booking");
const { createRateLimiter } = require("../services/rateLimitStore");
const razorpay = require("../services/razorpay");

const router = express.Router();

const ADVANCE_PERCENT = 20;

// Payment endpoints get their own limiter — lower volume than search, but
// each hit can create a real order with a payment gateway, so it's worth
// capping independently of the general API traffic.
const paymentLimiter = createRateLimiter({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/payments/config — public. Tells the frontend whether to show
// a "pay advance" option at all, and gives it the *public* key_id (safe
// to expose client-side — Razorpay's checkout.js needs it to open the
// payment modal). key_secret never leaves the backend.
router.get("/config", (req, res) => {
  res.json({
    enabled: razorpay.isConfigured(),
    keyId: process.env.RAZORPAY_KEY_ID || null,
    advancePercent: ADVANCE_PERCENT,
  });
});

// POST /api/payments/create-order  { bookingId }
router.post("/create-order", paymentLimiter, async (req, res) => {
  const { bookingId } = req.body || {};
  if (!bookingId) {
    return res.status(400).json({ error: "bookingId is required" });
  }

  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (!booking.estimatedFare) {
      return res.status(400).json({ error: "This booking has no fare to base a payment on" });
    }

    const advanceAmount = Math.round((booking.estimatedFare * ADVANCE_PERCENT) / 100);

    const order = await razorpay.createOrder({
      amountRupees: advanceAmount,
      receipt: `booking_${booking._id}`,
      notes: { bookingId: booking._id.toString(), from: booking.from, to: booking.to },
    });

    booking.razorpayOrderId = order.id;
    booking.advanceAmount = advanceAmount;
    await booking.save();

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    if (err.code === "NOT_CONFIGURED") {
      return res.status(503).json({ error: "Payments are not configured" });
    }
    res.status(503).json({ error: "Could not create payment order, please try again" });
  }
});

// POST /api/payments/verify  { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
router.post("/verify", paymentLimiter, async (req, res) => {
  const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing payment verification fields" });
  }

  const valid = razorpay.verifySignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!valid) {
    await Booking.findByIdAndUpdate(bookingId, { $set: { paymentStatus: "failed" } }).catch(() => {});
    return res.status(400).json({ error: "Payment verification failed" });
  }

  try {
    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { $set: { paymentStatus: "advance_paid", razorpayPaymentId: razorpay_payment_id } },
      { new: true }
    ).lean();
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json({ verified: true, paymentStatus: booking.paymentStatus });
  } catch (err) {
    res.status(503).json({ error: "Payment verified but booking update failed — contact support" });
  }
});

module.exports = router;
