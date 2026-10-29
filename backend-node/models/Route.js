const mongoose = require("mongoose");
const { Schema } = mongoose;

const RouteSchema = new Schema({
  from: { type: String, required: true, trim: true },
  to: { type: String, required: true, trim: true },
  km: { type: Number, required: true },
  hours: { type: String, required: true },
  fare: { type: Number, required: true },
});

// Route search ("Chandigarh to Delhi", "cabs from Chandigarh") is the
// highest-volume read on this site — every homepage visit and every
// autocomplete keystroke can hit it. A text index lets Mongo serve that
// out of an inverted index instead of scanning + regexing every document.
RouteSchema.index({ from: "text", to: "text" });

// Exact-match lookups (e.g. rendering a specific route page) skip the text
// index entirely and use this compound index instead.
RouteSchema.index({ from: 1, to: 1 }, { unique: true });

module.exports = mongoose.models.Route || mongoose.model("Route", RouteSchema);
