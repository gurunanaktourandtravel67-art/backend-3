const mongoose = require("mongoose");
const { Schema } = mongoose;

const GalleryPhotoSchema = new Schema(
  {
    imageUrl: { type: String, required: true, trim: true },
    caption: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "" }, // e.g. "Fleet", "Destinations", "Events" — optional filter tag
    order: { type: Number, default: 0 }, // lower shows first; ties broken by newest first
    active: { type: Boolean, default: true }, // inactive stays in the admin list but hides from the public gallery
  },
  { timestamps: true }
);

GalleryPhotoSchema.index({ active: 1, order: 1, createdAt: -1 });

module.exports = mongoose.models.GalleryPhoto || mongoose.model("GalleryPhoto", GalleryPhotoSchema);
