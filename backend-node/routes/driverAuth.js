const express = require("express");
const bcrypt = require("bcryptjs");
const Driver = require("../models/Driver");
const { createRateLimiter } = require("../services/rateLimitStore");
const { signDriverToken, requireDriver, revokeDriverToken } = require("../middleware/driverAuth");
const google = require("../services/googleAuth");
const crypto = require("crypto");
const { sendMail } = require("../services/mailer");
const { notifyAdmins } = require("../services/adminNotify");

const router = express.Router();

const authLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});

function driverPublicShape(d) {
  return {
    id: d._id.toString(),
    name: d.name,
    email: d.email,
    phone: d.phone || "",
    vehicleNumber: d.vehicleNumber || "",
    accountStatus: d.accountStatus,
    onDuty: d.onDuty,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get("/config", (req, res) => res.json({ googleSignIn: google.isConfigured() }));

router.post("/signup", authLimiter, async (req, res) => {
  const { name, email, password, phone, vehicleNumber } = req.body || {};
  if (!name || !email || !password || !phone || !vehicleNumber) {
    return res.status(400).json({ error: "name, email, password, phone and vehicleNumber are required" });
  }
  if (!EMAIL_RE.test(String(email))) return res.status(400).json({ error: "Enter a valid email" });
  if (String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  try {
    const lower = String(email).trim().toLowerCase();
    if (await Driver.findOne({ email: lower })) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    const driver = await Driver.create({
      name: String(name).trim(),
      email: lower,
      passwordHash: await bcrypt.hash(String(password), 10),
      phone: String(phone).trim(),
      vehicleNumber: String(vehicleNumber).trim().toUpperCase(),
    });
    notifyAdmins({
      title: "New driver signup",
      body: `${driver.name} · Vehicle ${driver.vehicleNumber} is waiting for approval`,
      data: { type: "driver_signup", driverId: String(driver._id) },
    });
    res.status(201).json({ token: signDriverToken(driver), driver: driverPublicShape(driver) });
  } catch (err) {
    res.status(503).json({ error: "Sign-up unavailable, please retry" });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });
  try {
    const driver = await Driver.findOne({ email: String(email).trim().toLowerCase() });
    const ok = driver && driver.passwordHash && (await bcrypt.compare(String(password), driver.passwordHash));
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });
    res.json({ token: signDriverToken(driver), driver: driverPublicShape(driver) });
  } catch (err) {
    res.status(503).json({ error: "Login unavailable, please retry" });
  }
});

router.post("/google", authLimiter, async (req, res) => {
  const { idToken, phone, vehicleNumber } = req.body || {};
  if (!idToken) return res.status(400).json({ error: "idToken is required" });
  if (!google.isConfigured()) return res.status(501).json({ error: "Google sign-in is not enabled on this server" });

  let info;
  try {
    info = await google.verifyGoogleIdToken(idToken);
  } catch (err) {
    return res.status(401).json({ error: "Google sign-in could not be verified" });
  }

  try {
    let driver = await Driver.findOne({ $or: [{ googleId: info.googleId }, { email: info.email }] });
    if (!driver) {
      // New Google drivers must supply phone + vehicle, same as email signup.
      if (!phone || !vehicleNumber) {
        return res.status(422).json({ error: "phone and vehicleNumber are required for new accounts", needsProfile: true });
      }
      driver = await Driver.create({
        name: info.name,
        email: info.email,
        googleId: info.googleId,
        phone: String(phone).trim(),
        vehicleNumber: String(vehicleNumber).trim().toUpperCase(),
      });
      notifyAdmins({
        title: "New driver signup",
        body: `${driver.name} · Vehicle ${driver.vehicleNumber} is waiting for approval`,
        data: { type: "driver_signup", driverId: String(driver._id) },
      });
    } else if (!driver.googleId) {
      driver.googleId = info.googleId; // link existing email account
      await driver.save();
    }
    res.json({ token: signDriverToken(driver), driver: driverPublicShape(driver) });
  } catch (err) {
    res.status(503).json({ error: "Sign-in unavailable, please retry" });
  }
});

const resetLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reset attempts, please try again later" },
});

const RESET_TTL_MS = 15 * 60_000;
const MAX_RESET_ATTEMPTS = 5;

function hashCode(email, code) {
  return crypto.createHmac("sha256", process.env.JWT_SECRET).update(`${email}:${code}`).digest("hex");
}

// Always answers the same way whether or not the email exists, so this
// can't be used to find out which emails are registered drivers.
router.post("/forgot-password", resetLimiter, async (req, res) => {
  const email = String((req.body || {}).email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email" });
  const generic = { status: "If that email has a driver account, a reset code has been sent." };
  try {
    const driver = await Driver.findOne({ email });
    if (driver) {
      const code = String(crypto.randomInt(100000, 1000000));
      driver.resetCodeHash = hashCode(email, code);
      driver.resetCodeExpires = new Date(Date.now() + RESET_TTL_MS);
      driver.resetAttempts = 0;
      await driver.save();
      await sendMail({
        to: email,
        subject: "Your Averra Driver password reset code",
        text: `Your Averra Driver password reset code is ${code}. It expires in 15 minutes. If you didn't ask for this, ignore this email.`,
      }).catch((e) => console.error("Reset email failed:", e.message));
    }
    res.json(generic);
  } catch (err) {
    res.status(503).json({ error: "Unavailable, please retry" });
  }
});

router.post("/reset-password", resetLimiter, async (req, res) => {
  const { email, code, newPassword } = req.body || {};
  const lower = String(email || "").trim().toLowerCase();
  if (!lower || !code || !newPassword) {
    return res.status(400).json({ error: "email, code and newPassword are required" });
  }
  if (String(newPassword).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  const bad = { error: "Invalid or expired code" };
  try {
    const driver = await Driver.findOne({ email: lower });
    if (
      !driver ||
      !driver.resetCodeHash ||
      !driver.resetCodeExpires ||
      driver.resetCodeExpires < new Date() ||
      driver.resetAttempts >= MAX_RESET_ATTEMPTS
    ) {
      return res.status(400).json(bad);
    }
    const given = Buffer.from(hashCode(lower, String(code).trim()));
    const stored = Buffer.from(driver.resetCodeHash);
    if (given.length !== stored.length || !crypto.timingSafeEqual(given, stored)) {
      driver.resetAttempts += 1;
      await driver.save();
      return res.status(400).json(bad);
    }
    driver.passwordHash = await bcrypt.hash(String(newPassword), 10);
    driver.resetCodeHash = undefined;
    driver.resetCodeExpires = undefined;
    driver.resetAttempts = 0;
    await driver.save();
    res.json({ status: "password_reset" });
  } catch (err) {
    res.status(503).json({ error: "Unavailable, please retry" });
  }
});

router.post("/logout", requireDriver, async (req, res) => {
  await revokeDriverToken(req.token);
  res.json({ status: "logged_out" });
});

router.get("/me", requireDriver, async (req, res) => {
  try {
    const d = await Driver.findById(req.driverId);
    if (!d) return res.status(401).json({ error: "Account no longer exists" });
    res.json(driverPublicShape(d));
  } catch (err) {
    res.status(503).json({ error: "Unavailable" });
  }
});

module.exports = router;
module.exports.driverPublicShape = driverPublicShape;
