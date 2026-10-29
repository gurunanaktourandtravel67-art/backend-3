const mongoose = require("mongoose");
const { Schema } = mongoose;

const CabTypeSchema = new Schema({
  id: { type: String, required: true, unique: true }, // e.g. "sedan"
  label: { type: String, required: true },
  example: { type: String, required: true },
  seats: { type: Number, required: true },
  baseKm: { type: Number, required: true },
  baseFare: { type: Number, required: true },
  perKm: { type: Number, required: true },
  // Optional marketing discount shown as "X% off" with a struck-through MRP
  // (MRP = price / (1 - X/100)). 0 = no discount shown. Set in admin Meter rates.
  discountPercent: { type: Number, default: 0, min: 0, max: 60 },
});

module.exports = mongoose.models.CabType || mongoose.model("CabType", CabTypeSchema);
