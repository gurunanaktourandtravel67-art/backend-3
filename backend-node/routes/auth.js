const express = require("express");
const { createRateLimiter } = require("../services/rateLimitStore");
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const { signAdminToken, requireAdmin, revokeToken } = require("../middleware/auth");

const router = express.Router();

// Brute-force protection — login attempts are the one endpoint in this
// app where a tight limit matters more than convenience.
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later" },
});

router.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  try {
    const admin = await Admin.findOne({ username: username.trim().toLowerCase() });
    // Same generic error whether the username doesn't exist or the
    // password is wrong — don't help an attacker enumerate usernames.
    if (!admin) return res.status(401).json({ error: "Invalid username or password" });

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid username or password" });

    const token = signAdminToken(admin);
    res.json({ token, username: admin.username, expiresIn: "12h" });
  } catch (err) {
    res.status(503).json({ error: "Login service unavailable, please retry" });
  }
});

router.post("/logout", requireAdmin, async (req, res) => {
  await revokeToken(req.token);
  res.json({ status: "logged_out" });
});

router.get("/me", requireAdmin, (req, res) => {
  res.json({ username: req.admin.username });
});

module.exports = router;
