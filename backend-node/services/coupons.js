const Coupon = require("../models/Coupon");
const Booking = require("../models/Booking");

const normalize = (code) => String(code || "").trim().toUpperCase();

class CouponError extends Error {}

function discountFor(coupon, fare) {
  let d = coupon.type === "percent" ? (fare * coupon.value) / 100 : coupon.value;
  if (coupon.type === "percent" && coupon.maxDiscount > 0) d = Math.min(d, coupon.maxDiscount);
  d = Math.min(Math.round(d), Math.max(0, fare - 1)); // never free / negative
  return Math.max(0, d);
}

/**
 * Checks a code against a server-computed fare. Throws CouponError with a
 * rider-friendly message, else returns { coupon, discount, finalFare }.
 * mobileNumber (optional here, required at booking time) enables the
 * per-user limit.
 */
async function checkCoupon(code, fare, mobileNumber) {
  const c = normalize(code);
  const coupon = c ? await Coupon.findOne({ code: c }) : null;
  const now = new Date();
  if (!coupon || !coupon.active) throw new CouponError("This coupon code isn't valid");
  if (coupon.validFrom && now < coupon.validFrom) throw new CouponError("This coupon isn't active yet");
  if (coupon.validTo && now > coupon.validTo) throw new CouponError("This coupon has expired");
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) throw new CouponError("This coupon has been fully used");
  if (fare < coupon.minFare) throw new CouponError(`Valid on fares of ₹${coupon.minFare} or more`);
  if (mobileNumber && coupon.perUserLimit > 0) {
    const used = await Booking.countDocuments({
      couponCode: coupon.code,
      mobileNumber,
      status: { $ne: "cancelled" },
    });
    if (used >= coupon.perUserLimit) throw new CouponError("You've already used this coupon");
  }
  const discount = discountFor(coupon, fare);
  return { coupon, discount, finalFare: fare - discount };
}

/** Atomically takes one redemption (race-safe against the usage limit). */
async function redeem(coupon) {
  const filter = { _id: coupon._id };
  if (coupon.usageLimit > 0) filter.usedCount = { $lt: coupon.usageLimit };
  const r = await Coupon.updateOne(filter, { $inc: { usedCount: 1 } });
  if (r.modifiedCount !== 1) throw new CouponError("This coupon has been fully used");
}

async function release(coupon) {
  await Coupon.updateOne({ _id: coupon._id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }).catch(() => {});
}

module.exports = { checkCoupon, redeem, release, CouponError, normalize };
