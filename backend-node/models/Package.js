const mongoose = require("mongoose");
const { Schema } = mongoose;

const PackageSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    durationLabel: { type: String, required: true, trim: true }, // e.g. "3 Days / 2 Nights"
    cities: { type: String, trim: true }, // e.g. "Chandigarh, Manali, Shimla"
    active: { type: Boolean, default: true }, // inactive packages stay in the admin list but hide from the public site
  },
  { timestamps: true }
);

PackageSchema.index({ active: 1, createdAt: -1 });

module.exports = mongoose.models.Package || mongoose.model("Package", PackageSchema);
