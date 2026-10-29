const Driver = require("../models/Driver");

/**
 * Customer-facing view of bookings: attaches `driver` ({name, phone,
 * vehicleNumber}) ONLY once the admin has approved that driver for the
 * booking, and strips internal assignment fields either way. Accepts a
 * lean doc or an array of them.
 */
async function withPublicDriver(input) {
  const list = Array.isArray(input) ? input : [input];
  const ids = [
    ...new Set(
      list
        .filter((b) => b.driverAssignmentStatus === "approved" && b.claimedByDriverId)
        .map((b) => String(b.claimedByDriverId))
    ),
  ];
  const drivers = ids.length
    ? await Driver.find({ _id: { $in: ids } }).select("name phone vehicleNumber").lean()
    : [];
  const byId = new Map(drivers.map((d) => [String(d._id), d]));

  const out = list.map((b) => {
    const { claimedByDriverId, driverAssignmentStatus, ...rest } = b;
    const d =
      driverAssignmentStatus === "approved" && claimedByDriverId
        ? byId.get(String(claimedByDriverId))
        : null;
    return d ? { ...rest, driver: { name: d.name, phone: d.phone || "", vehicleNumber: d.vehicleNumber || "" } } : rest;
  });
  return Array.isArray(input) ? out : out[0];
}

module.exports = { withPublicDriver };
