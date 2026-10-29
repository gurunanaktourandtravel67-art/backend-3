const mongoose = require("mongoose");
const { Schema } = mongoose;

// Public (no-login) customer feedback. Held as "pending" until an admin
// approves it, so spam/abuse never shows up on the site.
const FeedbackSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000, default: "" },
    route: { type: String, trim: true, maxlength: 80, default: "" },
    phone: { type: String, trim: true, maxlength: 20, default: "" }, // optional, admin-only
    status: { type: String, enum: ["pending", "approved", "hidden"], default: "pending" },
  },
  { timestamps: true }
);

FeedbackSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.Feedback || mongoose.model("Feedback", FeedbackSchema);
