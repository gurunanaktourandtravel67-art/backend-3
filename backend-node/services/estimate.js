// Offline fallback: straight-line distance between two known cities × a road
// factor. Used only when Google Maps and OSRM are both unavailable, so the
// rider still gets a sensible city-to-city distance instead of a stale number.
const COORDS = require("./cityCoords.json");

const HILLS = new Set([
  "Shimla","Dalhousie","Dharamshala","Manali","Kullu","Kasauli","Solan","Kasol","Bhadi","Nahan",
  "Jammu","Jammu Cantt","Srinagar","Leh","Nainital","Mussoorie","Rishikesh","Almora","Bageshwar",
  "Pithoragarh","Chamoli","Tehri","Rudraprayag","Uttarkashi","Champawat","Pauri Garhwal",
]);

const lookup = new Map(Object.keys(COORDS).map((k) => [k.toLowerCase(), k]));
const norm = (s) => lookup.get(String(s || "").trim().toLowerCase());

function haversineKm([la1, lo1], [la2, lo2]) {
  const r = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(r(la2 - la1) / 2) ** 2 +
    Math.cos(r(la1)) * Math.cos(r(la2)) * Math.sin(r(lo2 - lo1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Returns { distanceKm, durationText } or null if either city is unknown. */
function estimateDistance(origin, destination) {
  const a = norm(origin), b = norm(destination);
  if (!a || !b || a === b) return null;
  const factor = HILLS.has(a) || HILLS.has(b) ? 1.4 : 1.12;
  const km = Math.max(1, Math.round(haversineKm(COORDS[a], COORDS[b]) * factor));
  const hrs = km / (factor > 1.12 ? 40 : 55);
  const h = Math.floor(hrs), m = Math.round((hrs - h) * 60);
  return { distanceKm: km, durationText: `${h ? h + " hour" + (h > 1 ? "s " : " ") : ""}${m} mins`.trim() };
}

module.exports = { estimateDistance };
