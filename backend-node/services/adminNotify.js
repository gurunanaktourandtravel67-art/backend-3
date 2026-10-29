const Admin = require("../models/Admin");
const { sendPushToToken } = require("./push");

const DEAD = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

/**
 * Pushes an alert to every registered admin phone (high-priority, on the
 * app's loud "admin_alerts" channel). Fire-and-forget: never throws, and
 * tokens Firebase says are dead (app uninstalled) are pruned automatically.
 */
async function notifyAdmins({ title, body, data = {}, ring = false }) {
  try {
    const admins = await Admin.find({ "deviceTokens.0": { $exists: true } }).select("deviceTokens").lean();
    const tokens = [...new Set(admins.flatMap((a) => a.deviceTokens))];
    if (tokens.length === 0) return;
    const results = await Promise.all(
      tokens.map((t) =>
        sendPushToToken(
          t,
          { title, body, data },
          // ring=true → the loud ringtone channel (new bookings, driver requests)
          ring ? { channelId: "admin_ring", sound: "admin_ringtone" } : { channelId: "admin_alerts", sound: "default" }
        )
      )
    );
    const dead = tokens.filter((_, i) => results[i].code && DEAD.has(results[i].code));
    if (dead.length) await Admin.updateMany({}, { $pull: { deviceTokens: { $in: dead } } });
  } catch (err) {
    console.error("Admin notification failed:", err.message);
  }
}

module.exports = { notifyAdmins };
