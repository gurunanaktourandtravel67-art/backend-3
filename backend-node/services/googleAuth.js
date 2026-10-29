// Verifies a Google ID token sent by the Flutter driver app. Needs
// GOOGLE_CLIENT_ID (the OAuth *Web* client ID). Unset => feature disabled.
let client = null;

function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID);
}

async function verifyGoogleIdToken(idToken) {
  if (!isConfigured()) {
    const e = new Error("Google sign-in is not configured");
    e.code = "NOT_CONFIGURED";
    throw e;
  }
  if (!client) {
    const { OAuth2Client } = require("google-auth-library");
    client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
  const p = ticket.getPayload();
  if (!p || !p.email || p.email_verified === false) throw new Error("Google account email not verified");
  return { googleId: p.sub, email: p.email.toLowerCase(), name: p.name || p.email.split("@")[0] };
}

module.exports = { isConfigured, verifyGoogleIdToken };
