require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { connectDB } = require("./db/connect");
const cabsRouter = require("./routes/cabs");
const fareRouter = require("./routes/fare");
const bookingsRouter = require("./routes/bookings");
const searchRouter = require("./routes/search");
const authRouter = require("./routes/auth");
const adminRouter = require("./routes/admin");
const adminRoutesRouter = require("./routes/adminRoutes");
const adminPackagesRouter = require("./routes/adminPackages");
const packagesRouter = require("./routes/packages");
const adminGalleryRouter = require("./routes/adminGallery");
const galleryRouter = require("./routes/gallery");
const appVersionRouter = require("./routes/appVersion");
const adminAppConfigRouter = require("./routes/adminAppConfig");
const adminCabTypesRouter = require("./routes/adminCabTypes");
const distanceRouter = require("./routes/distance");
const paymentsRouter = require("./routes/payments");
const driverAuthRouter = require("./routes/driverAuth");
const driverRouter = require("./routes/driver");
const adminDriversRouter = require("./routes/adminDrivers");

const app = express();
const PORT = process.env.PORT || 4000;

// Render (and Railway/Heroku/most PaaS hosts) sit behind a reverse proxy
// that sets X-Forwarded-For. Without this, Express doesn't trust that
// header, so express-rate-limit (used throughout routes/*.js) can't
// reliably tell which IP a request came from — it either throws
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR or, worse, silently rate-limits
// everyone as if they share one IP (the proxy's). "1" trusts exactly one
// hop — the immediate proxy in front of this server — which is correct
// for these hosts; don't use `true` (trusts every hop), which would let
// a client spoof their own X-Forwarded-For to dodge rate limits entirely
// on hosts with more than one proxy layer.
app.set("trust proxy", 1);

// In production, set ALLOWED_ORIGIN to your deployed frontend's URL
// (e.g. https://averra.vercel.app). Left unset, this allows all
// origins, which is fine for local development only.
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors(allowedOrigin ? { origin: allowedOrigin } : {}));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "averra-backend-node" });
});

app.use("/api", cabsRouter);
app.use("/api/fare", fareRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/routes", searchRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin/feedback", require("./routes/adminFeedback"));
app.use("/api/feedback", require("./routes/feedback"));
app.use("/api/promo", require("./routes/promo"));
app.use("/api/coupons", require("./routes/coupons"));
app.use("/api/admin/coupons", require("./routes/adminCoupons"));
app.use("/api/admin/routes", adminRoutesRouter);
app.use("/api/admin/packages", adminPackagesRouter);
app.use("/api/admin/app-config", adminAppConfigRouter);
app.use("/api/admin/cabtypes", adminCabTypesRouter);
app.use("/api/admin/gallery", adminGalleryRouter);
app.use("/api/admin/drivers", adminDriversRouter);
app.use("/api/admin", adminRouter);
app.use("/api/packages", packagesRouter);
app.use("/api/gallery", galleryRouter);
app.use("/api/app-version", appVersionRouter);
app.use("/api/distance", distanceRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/driver/auth", driverAuthRouter);
app.use("/api/driver", driverRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error("Could not connect to MongoDB:", err.message);
    console.error("Start MongoDB (see docker-compose.yml) or set MONGODB_URI, then retry.");
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Averra Node API listening on http://localhost:${PORT}`);
    console.log(
      `Fare requests are forwarded to ${process.env.JAVA_FARE_SERVICE_URL || "http://localhost:8080/api/fare/calculate"}`
    );
    console.log(
      process.env.GOOGLE_MAPS_API_KEY
        ? `Distance calculation: Google Maps (key ends in …${process.env.GOOGLE_MAPS_API_KEY.slice(-4)}), falling back to free OSRM/OpenStreetMap if Google fails`
        : "Distance calculation: free OSRM + OpenStreetMap (GOOGLE_MAPS_API_KEY not set)"
    );
    console.log(
      process.env.REDIS_URL
        ? "Redis shared cache/rate-limit store: enabled"
        : "Redis shared cache/rate-limit store: disabled (REDIS_URL not set) — using in-process fallback"
    );
    console.log(
      process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
        ? "Razorpay advance payments: enabled"
        : "Razorpay advance payments: disabled (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET not set)"
    );
    console.log(
      process.env.SMTP_HOST
        ? "Driver password-reset email: enabled (SMTP)"
        : "Driver password-reset email: disabled (SMTP_HOST not set) — reset codes are printed in this log only"
    );
    console.log(
      process.env.GOOGLE_CLIENT_ID
        ? "Driver Google sign-in: enabled"
        : "Driver Google sign-in: disabled (GOOGLE_CLIENT_ID not set) — email/password still works"
    );
  });
}

start();
