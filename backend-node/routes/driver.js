const express = require("express");
const Driver = require("../models/Driver");
const Booking = require("../models/Booking");
const { requireDriver } = require("../middleware/driverAuth");
const { sendPushToToken } = require("../services/push");
const { notifyAdmins } = require("../services/adminNotify");

const router = express.Router();
router.use(requireDriver);

async function loadDriver(req, res) {
  const d = await Driver.findById(req.driverId);
  if (!d) {
    res.status(401).json({ error: "Account no longer exists" });
    return null;
  }
  return d;
}

// Toggle duty. Only admin-approved drivers may go on duty.
router.patch("/duty", async (req, res) => {
  const { onDuty } = req.body || {};
  if (typeof onDuty !== "boolean") return res.status(400).json({ error: "onDuty must be true or false" });
  try {
    const d = await loadDriver(req, res);
    if (!d) return;
    if (onDuty && d.accountStatus !== "approved") {
      return res.status(403).json({ error: "Your account must be approved by admin before you can go on duty" });
    }
    d.onDuty = onDuty;
    await d.save();
    res.json({ onDuty: d.onDuty, accountStatus: d.accountStatus });
  } catch (err) {
    res.status(503).json({ error: "Unavailable, please retry" });
  }
});

// The driver's phone registers its FCM token here (null on logout).
router.patch("/device-token", async (req, res) => {
  const { token } = req.body || {};
  if (token != null && (typeof token !== "string" || token.length > 4096)) {
    return res.status(400).json({ error: "token must be a string or null" });
  }
  try {
    if (token) {
      // One phone, one driver: unlink this token from any other account first.
      await Driver.updateMany({ deviceToken: token, _id: { $ne: req.driverId } }, { $unset: { deviceToken: 1 } });
      await Driver.findByIdAndUpdate(req.driverId, { deviceToken: token });
    } else {
      await Driver.findByIdAndUpdate(req.driverId, { $unset: { deviceToken: 1 } });
    }
    res.json({ status: "ok" });
  } catch (err) {
    res.status(503).json({ error: "Unavailable, please retry" });
  }
});

// Open trips. Deliberately omits customerName / mobileNumber / pickupAddress.
router.get("/available-bookings", async (req, res) => {
  try {
    const d = await loadDriver(req, res);
    if (!d) return;
    if (d.accountStatus !== "approved" || !d.onDuty) {
      return res.json({ bookings: [], reason: d.accountStatus !== "approved" ? "not_approved" : "off_duty" });
    }
    const bookings = await Booking.find({ status: "pending_confirmation", driverAssignmentStatus: "unclaimed" })
      .select("from to distanceKm estimatedFare cabTypeId tripType date createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ bookings });
  } catch (err) {
    res.status(503).json({ error: "Unavailable, please retry" });
  }
});

// "I'm ready to take this route" — atomic so two drivers can't both claim it.
router.post("/available-bookings/:id/claim", async (req, res) => {
  try {
    const d = await loadDriver(req, res);
    if (!d) return;
    if (d.accountStatus !== "approved" || !d.onDuty) {
      return res.status(403).json({ error: "You must be approved and on duty" });
    }
    const updated = await Booking.findOneAndUpdate(
      { _id: req.params.id, status: "pending_confirmation", driverAssignmentStatus: "unclaimed" },
      { driverAssignmentStatus: "pending_admin_approval", claimedByDriverId: d._id },
      { new: true }
    ).select("from to distanceKm estimatedFare date driverAssignmentStatus");
    if (!updated) return res.status(409).json({ error: "This trip was already taken or is no longer available" });
    notifyAdmins({
      title: "Driver ready for a trip",
      body: `${d.name} · Vehicle ${d.vehicleNumber}: ${updated.from} → ${updated.to}`,
      data: { type: "driver_claim", bookingId: String(updated._id) },
      ring: true,
    });
    res.json({ status: "pending_admin_approval", booking: updated });
  } catch (err) {
    res.status(400).json({ error: "Invalid booking" });
  }
});

// Claims awaiting admin decision (route + rate only) or rejected.
router.get("/my-claims", async (req, res) => {
  try {
    const bookings = await Booking.find({
      claimedByDriverId: req.driverId,
      driverAssignmentStatus: "pending_admin_approval",
    })
      .select("from to distanceKm estimatedFare cabTypeId tripType date driverAssignmentStatus createdAt")
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ bookings });
  } catch (err) {
    res.status(503).json({ error: "Unavailable, please retry" });
  }
});

// Full details (incl. customer mobile) only AFTER admin approved this claim.
router.get("/my-trips", async (req, res) => {
  try {
    const d = await loadDriver(req, res);
    if (!d) return;
    if (d.accountStatus !== "approved") return res.json({ bookings: [] });
    const bookings = await Booking.find({
      claimedByDriverId: d._id,
      driverAssignmentStatus: "approved",
    })
      .select("-deviceToken -razorpayOrderId -razorpayPaymentId")
      .sort({ date: -1 })
      .limit(100)
      .lean();
    res.json({ bookings });
  } catch (err) {
    res.status(503).json({ error: "Unavailable, please retry" });
  }
});

// Driver marks an approved, confirmed ride as completed. Admin sees it as
// "completed by <driver> (<vehicle>)" and the customer is notified.
router.post("/my-trips/:id/complete", async (req, res) => {
  try {
    const d = await loadDriver(req, res);
    if (!d) return;
    const booking = await Booking.findOneAndUpdate(
      {
        _id: req.params.id,
        claimedByDriverId: d._id,
        driverAssignmentStatus: "approved",
        status: "confirmed",
      },
      { status: "completed", completedAt: new Date() },
      { new: true }
    ).select("-deviceToken -razorpayOrderId -razorpayPaymentId");
    if (!booking) {
      return res.status(409).json({ error: "This trip can't be completed (not confirmed, already completed, or not yours)" });
    }
    notifyAdmins({
      title: "Ride completed",
      body: `${d.name} · Vehicle ${d.vehicleNumber}: ${booking.from} → ${booking.to}`,
      data: { type: "ride_completed", bookingId: String(booking._id) },
    });
    const full = await Booking.findById(booking._id).select("deviceToken");
    sendPushToToken(full && full.deviceToken, {
      title: "Averra",
      body: "Trip complete — thanks for riding with Averra!",
      data: { bookingId: booking._id.toString(), status: "completed" },
    }).catch(() => {});
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: "Invalid booking" });
  }
});

module.exports = router;
