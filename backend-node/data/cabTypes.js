// Kept in sync with frontend/lib/data.js and with the pricing rules
// implemented in the Java fare-engine (backend-java).
const CAB_TYPES = [
  { id: "hatchback", label: "Hatchback", example: "Swift, Tiago or similar", seats: 4, baseKm: 50, baseFare: 700, perKm: 17.5 },
  { id: "sedan", label: "Sedan", example: "Dzire, Etios or similar", seats: 4, baseKm: 50, baseFare: 875, perKm: 13 },
  { id: "suv", label: "SUV", example: "Ertiga, Xylo or similar", seats: 6, baseKm: 50, baseFare: 1400, perKm: 15 },
  { id: "prime-sedan", label: "Prime Sedan", example: "Amaze, Etios or similar", seats: 4, baseKm: 50, baseFare: 1540, perKm: 18.5 },
  { id: "prime-suv", label: "Prime SUV", example: "Innova Crysta or similar", seats: 6, baseKm: 50, baseFare: 1925, perKm: 21 },
];

const CITIES = [
  "Chandigarh",
  "Ludhiana",
  "Delhi",
  "Mohali",
  "Panchkula",
  "Amritsar",
  "Shimla",
  "Zirakpur",
];

module.exports = { CAB_TYPES, CITIES };
