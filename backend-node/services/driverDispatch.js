const Driver = require("../models/Driver");
const { sendPushToToken } = require("./push");

/**
 * Rings every approved, on-duty driver's phone about a new open trip.
 * Deliberately sends only route + fare — the same fields drivers can see
 * in the open-trips list, never the customer's contact details.
 * Fire-and-forget: a failed push must never fail the booking itself.
 */
async function notifyDriversOfTrip(booking) {
  try {
    const drivers = await Driver.find({
      accountStatus: "approved",
      onDuty: true,
      deviceToken: { $exists: true, $ne: null },
    })
      .select("deviceToken")
      .limit(500)
      .lean();
    const fare = booking.estimatedFare != null ? ` · ₹${Math.round(booking.estimatedFare)}` : "";
    await Promise.all(
      drivers.map((d) =>
        sendPushToToken(
          d.deviceToken,
          {
            title: "New trip request",
            body: `${booking.from} → ${booking.to}${fare}`,
            data: { type: "trip_request", bookingId: String(booking._id) },
          },
          { channelId: "trip_requests", sound: "ringtone" }
        )
      )
    );
  } catch (err) {
    console.error("Driver trip notification failed:", err.message);
  }
}

module.exports = { notifyDriversOfTrip };
