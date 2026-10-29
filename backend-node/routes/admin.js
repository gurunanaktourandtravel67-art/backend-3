const express = require("express");
const Booking = require("../models/Booking");
const Admin = require("../models/Admin");
const { requireAdmin } = require("../middleware/auth");
const { sendPushToToken, isConfigured: pushConfigured } = require("../services/push");

const router = express.Router();

// Everything here requires a valid admin session.
router.use(requireAdmin);

const VALID_STATUSES = ["pending_confirmation", "confirmed", "cancelled", "completed"];

const STATUS_MESSAGES = {
  confirmed: (b) => `Your cab from ${b.from} to ${b.to} on ${b.date} is confirmed.`,
  cancelled: (b) => `Your booking from ${b.from} to ${b.to} on ${b.date} has been cancelled.`,
  completed: (b) => `Trip complete — thanks for riding with Averra!`,
  pending_confirmation: (b) => `Your booking from ${b.from} to ${b.to} is pending confirmation.`,
};

// The admin phone registers its FCM token to receive new-booking /
// driver-request alerts (see services/adminNotify.js); removed on sign-out.
router.post("/device-token", async (req, res) => {
  const { token } = req.body || {};
  if (typeof token !== "string" || !token || token.length > 4096) {
    return res.status(400).json({ error: "token is required" });
  }
  try {
    // One phone, one account: drop this token from any other admin, then add it here.
    await Admin.updateMany({ _id: { $ne: req.admin.sub } }, { $pull: { deviceTokens: token } });
    await Admin.updateOne({ _id: req.admin.sub }, { $addToSet: { deviceTokens: token } });
    // Keep the list bounded (newest 10 devices).
    await Admin.updateOne({ _id: req.admin.sub }, { $push: { deviceTokens: { $each: [], $slice: -10 } } });
    res.json({ status: "ok" });
  } catch (err) {
    res.status(503).json({ error: "Unavailable, please retry" });
  }
});

// Diagnostics for the app's "Alert status" screen.
router.get("/push-status", async (req, res) => {
  try {
    const a = await Admin.findById(req.admin.sub).select("deviceTokens").lean();
    res.json({ serverFirebaseConfigured: pushConfigured(), deviceCount: (a && a.deviceTokens.length) || 0 });
  } catch (err) {
    res.status(503).json({ error: "Unavailable, please retry" });
  }
});

// Sends a ringing test alert to THIS admin's registered phones and reports
// exactly why it failed if it did.
router.post("/test-push", async (req, res) => {
  try {
    if (!pushConfigured()) {
      return res.json({ sent: 0, reason: "The server has no Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT on the backend and restart it." });
    }
    const a = await Admin.findById(req.admin.sub).select("deviceTokens").lean();
    const tokens = (a && a.deviceTokens) || [];
    if (tokens.length === 0) {
      return res.json({ sent: 0, reason: "No phone is registered for your account yet. The app could not get a Firebase token — check Firebase setup in the app." });
    }
    const results = await Promise.all(
      tokens.map((t) =>
        sendPushToToken(
          t,
          { title: "Test alert", body: "If you hear this, ringtone alerts work.", data: { type: "new_booking", test: "1" } },
          { channelId: "admin_ring", sound: "admin_ringtone" }
        )
      )
    );
    const sent = results.filter((r) => r.sent).length;
    res.json({ sent, reason: sent ? null : results.map((r) => r.reason).filter(Boolean)[0] || "Unknown error" });
  } catch (err) {
    res.status(503).json({ error: "Unavailable, please retry" });
  }
});

router.post("/device-token/remove", async (req, res) => {
  const { token } = req.body || {};
  if (typeof token !== "string" || !token) return res.status(400).json({ error: "token is required" });
  try {
    await Admin.updateOne({ _id: req.admin.sub }, { $pull: { deviceTokens: token } });
    res.json({ status: "ok" });
  } catch (err) {
    res.status(503).json({ error: "Unavailable, please retry" });
  }
});

// GET /api/admin/bookings?status=&q=&page=&limit=
// Unlike the public GET /api/bookings (which requires a mobileNumber),
// this can list everything — that's the point of putting it behind auth.
router.get("/bookings", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = {};
  if (req.query.status) {
    filter.status = req.query.status;
  } else {
    // "All" means "everything active" — cancelled bookings clutter the
    // default view without being useful there; they're still one click
    // away via the Cancelled tab, which passes status=cancelled explicitly.
    filter.status = { $ne: "cancelled" };
  }

  // Free-text search across name/phone/route for the dispatcher's search box.
  if (req.query.q) {
    const q = String(req.query.q).trim();
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ customerName: rx }, { mobileNumber: rx }, { from: rx }, { to: rx }];
  }

  try {
    const [results, total] = await Promise.all([
      Booking.find(filter)
        .populate("claimedByDriverId", "name phone vehicleNumber")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter),
    ]);
    res.json({ results, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(503).json({ error: "Booking lookup unavailable" });
  }
});

// PATCH /api/admin/bookings/:id/status  { status: "confirmed" }
router.patch("/bookings/:id/status", async (req, res) => {
  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
  }

  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: { status, ...(status === "completed" ? { completedAt: new Date() } : {}) } },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Fire-and-forget: a push notification failing (no token, Firebase not
    // configured, expired token) should never fail the status update itself.
    sendPushToToken(booking.deviceToken, {
      title: "Averra",
      body: STATUS_MESSAGES[status](booking),
      data: { bookingId: booking._id.toString(), status },
    }).catch(() => {});

    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: "Invalid booking id or update failed" });
  }
});

module.exports = router;
