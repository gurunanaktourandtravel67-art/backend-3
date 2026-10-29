const mongoose = require("mongoose");
const { Schema } = mongoose;

const DriverSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    phone: { type: String, trim: true },
    vehicleNumber: { type: String, trim: true },
    // Admin vetting gate: no going on duty until approved.
    accountStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    onDuty: { type: Boolean, default: false },
    // Forgot-password: HMAC of the 6-digit code, never the code itself.
    resetCodeHash: { type: String },
    resetCodeExpires: { type: Date },
    // FCM token of the driver's phone, used to ring it for new trip requests.
    deviceToken: { type: String },
    resetAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

DriverSchema.index({ accountStatus: 1, createdAt: -1 });

module.exports = mongoose.models.Driver || mongoose.model("Driver", DriverSchema);
