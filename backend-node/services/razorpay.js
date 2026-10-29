const Razorpay = require("razorpay");
const crypto = require("crypto");

// RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET — from the Razorpay dashboard
// (Settings → API Keys). Test mode keys work exactly like live ones for
// development; switch to live keys only once you're ready to take real
// payments. Nothing here throws if they're missing — payment features
// just report themselves as disabled (see routes/payments.js), same
// degrade-gracefully pattern as every other optional integration in this
// project (AdSense, AdMob, Firebase, Google Maps).
let client = null;

function getClient() {
  if (client) return client;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;

  client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
}

function isConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/** amountRupees is a plain rupee amount (e.g. 599.5) — Razorpay's API
 * wants the smallest currency unit (paise), so this converts. */
async function createOrder({ amountRupees, receipt, notes }) {
  const razorpay = getClient();
  if (!razorpay) {
    const err = new Error("Razorpay is not configured");
    err.code = "NOT_CONFIGURED";
    throw err;
  }

  return razorpay.orders.create({
    amount: Math.round(amountRupees * 100),
    currency: "INR",
    receipt,
    notes,
  });
}

/** Verifies the signature Razorpay's checkout returns after a successful
 * payment — this is what actually confirms the payment is genuine and
 * wasn't forged client-side. Never trust a "payment succeeded" callback
 * from the browser without this check. */
function verifySignature({ orderId, paymentId, signature }) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return false;

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return expected === signature;
}

module.exports = { isConfigured, createOrder, verifySignature };
