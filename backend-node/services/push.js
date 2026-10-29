const admin = require("firebase-admin");

// FIREBASE_SERVICE_ACCOUNT holds the *entire* service-account JSON from
// Firebase Console → Project settings → Service accounts → Generate new
// private key, as a single-line string (base64-encoded, to survive being
// pasted into a .env file / hosting dashboard without escaping issues).
//
// Nothing here throws if it's missing — push notifications just silently
// no-op, the same way AdSense/AdMob features degrade when unconfigured,
// so the rest of the app keeps working without Firebase set up yet.
let app = null;

function getApp() {
  if (app) return app;
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!encoded) return null;

  try {
    const json = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    app = admin.initializeApp({ credential: admin.credential.cert(json) });
    return app;
  } catch (err) {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT is set but couldn't be parsed — push notifications are disabled.",
      err.message
    );
    return null;
  }
}

/**
 * Sends a push notification to a single device token. Fails silently
 * (logs, doesn't throw) — a booking status update should never fail
 * just because a push notification couldn't be delivered (expired
 * token, Firebase not configured, network blip, etc).
 */
async function sendPushToToken(token, { title, body, data = {} }, options = {}) {
  if (!token) return { sent: false, reason: "no-token" };

  const firebaseApp = getApp();
  if (!firebaseApp) return { sent: false, reason: "firebase-not-configured" };

  try {
    await admin.messaging(firebaseApp).send({
      token,
      notification: { title, body },
      // Used for driver trip requests: a high-priority message that lands
      // on the app's "trip_requests" channel (loud ringtone + vibration).
      ...(options.channelId
        ? {
            android: {
              priority: "high",
              ttl: 60_000, // a trip request is stale after a minute
              notification: { channelId: options.channelId, sound: options.sound || "default" },
            },
          }
        : {}),
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    });
    return { sent: true };
  } catch (err) {
    console.error(`Push notification failed for token ${token.slice(0, 12)}…:`, err.message);
    return { sent: false, reason: err.message, code: err.code };
  }
}

function isConfigured() {
  return Boolean(getApp());
}

module.exports = { sendPushToToken, isConfigured };
