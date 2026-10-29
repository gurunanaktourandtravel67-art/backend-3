const { getCabTypes, getCabTypeById } = require("./cabTypeCache");

const JAVA_FARE_SERVICE_URL =
  process.env.JAVA_FARE_SERVICE_URL || "http://localhost:8080/api/fare/calculate";

function localEstimate(cab, distanceKm) {
  const extraKm = Math.max(0, distanceKm - cab.baseKm);
  return { total: Math.round(cab.baseFare + extraKm * cab.perKm), source: "node-fallback" };
}

/**
 * Server-side fare for a cab + distance (Java fare engine, with the same
 * Node fallback the /api/fare/estimate route uses). Returns
 * { total, source } or null when the cab type is unknown.
 */
async function getFareQuote(cabTypeId, distanceKm, tripType) {
  const cab = getCabTypeById(await getCabTypes(), cabTypeId);
  if (!cab) return null;
  try {
    const javaRes = await fetch(JAVA_FARE_SERVICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cabTypeId, distanceKm, tripType,
        baseFare: cab.baseFare, perKm: cab.perKm, includedKm: cab.baseKm,
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!javaRes.ok) throw new Error(`Java service responded ${javaRes.status}`);
    const data = await javaRes.json();
    return { total: data.total, source: "java-fare-engine" };
  } catch (err) {
    return localEstimate(cab, distanceKm);
  }
}

module.exports = { getFareQuote };
