const mongoose = require("mongoose");
const { Schema } = mongoose;

const CouponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 30 },
    description: { type: String, trim: true, maxlength: 120, default: "" },
    type: { type: String, enum: ["percent", "flat"], required: true },
    value: { type: Number, required: true, min: 1 }, // % (1-100) or ₹
    maxDiscount: { type: Number, min: 0, default: 0 }, // cap for percent coupons; 0 = no cap
    minFare: { type: Number, min: 0, default: 0 }, // fare must be at least this
    validFrom: { type: Date },
    validTo: { type: Date },
    usageLimit: { type: Number, min: 0, default: 0 }, // total redemptions; 0 = unlimited
    perUserLimit: { type: Number, min: 0, default: 1 }, // per mobile number; 0 = unlimited
    usedCount: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Coupon || mongoose.model("Coupon", CouponSchema);
