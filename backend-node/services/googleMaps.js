const { getOsrmDistance } = require("./osrm");
const { estimateDistance } = require("./estimate");

// GOOGLE_MAPS_API_KEY (optional — without it the free OSRM/OpenStreetMap
// route in services/osrm.js is used) — from console.cloud.google.com: create a project,
// enable the "Distance Matrix API", create an API key, and restrict it
// (HTTP referrer restriction won't work here since this call is
// server-to-server — use an IP restriction to your backend's outbound IP,
// or leave unrestricted but keep the key server-side only, never in
// frontend code, which is exactly why this lives on the backend).
//
// Nothing here throws if it's missing — distance calculation just no-ops,
// same pattern as AdSense/AdMob/Firebase, so booking still works with the
// existing manual distance field until this is configured.

// Road distance between two named places doesn't change — caching
// aggressively saves real money on a metered API. Keyed by normalized
// "origin|destination", 30-day TTL, in-process (move to Redis/Mongo if
// you run more than one Node instance so cache hits are shared).
const cache = new Map();
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function cacheKey(origin, destination) {
  return `${origin.trim().toLowerCase()}|${destination.trim().toLowerCase()}`;
}

/**
 * Returns { distanceKm, durationText } or throws. Callers should catch and
 * fall back to letting the rider enter distance manually.
 */
async function getGoogleDistance(origin, destination) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    const err = new Error("GOOGLE_MAPS_API_KEY is not configured");
    err.code = "NOT_CONFIGURED";
    throw err;
  }

  const key = cacheKey(origin, destination);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("units", "metric");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) {
    const err = new Error(`Google Distance Matrix API returned ${res.status}`);
    err.code = "UPSTREAM_ERROR";
    throw err;
  }

  const data = await res.json();
  const element = data.rows?.[0]?.elements?.[0];

  if (data.status !== "OK" || !element || element.status !== "OK") {
    const reason = element?.status || data.status;
    // Google puts the actual cause here — "This API project is not
    // authorized to use this API" (API not enabled), "You must enable
    // Billing on the Google Cloud Project", "This IP, site or mobile
    // application is not authorized to use this API key" (wrong
    // restriction type on the key), etc. Logging it server-side is the
    // fastest way to actually diagnose a failure — the client only ever
    // sees "distance unavailable", never Google's real reason.
    console.error(
      `Google Distance Matrix failed for "${origin}" → "${destination}": ${reason}` +
        (data.error_message ? ` — ${data.error_message}` : "")
    );
    const err = new Error(
      `Could not calculate distance for "${origin}" to "${destination}" (${reason})`
    );
    err.code = "NO_ROUTE";
    throw err;
  }

  const value = {
    distanceKm: Math.round(element.distance.value / 1000),
    durationText: element.duration.text,
  };

  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/**
 * Picks a provider. DISTANCE_PROVIDER = "auto" (default) | "google" | "osrm".
 *  - auto: Google if GOOGLE_MAPS_API_KEY is set, and if Google fails for any
 *    reason (API not enabled, billing off, quota...) quietly fall back to the
 *    free OpenStreetMap/OSRM route so the rider still gets a distance.
 *    No key at all → OSRM directly.
 * Returns { distanceKm, durationText, source: "google-maps" | "osrm" }.
 */
async function getDistance(origin, destination) {
  const mode = (process.env.DISTANCE_PROVIDER || "auto").toLowerCase();
  const hasKey = Boolean(process.env.GOOGLE_MAPS_API_KEY);

  if (mode === "google") {
    return { ...(await getGoogleDistance(origin, destination)), source: "google-maps" };
  }
  if (mode === "auto" && hasKey) {
    try {
      return { ...(await getGoogleDistance(origin, destination)), source: "google-maps" };
    } catch (err) {
      console.error(`Google distance failed (${err.message}) — falling back to OSRM`);
    }
  }
  try {
    return { ...(await getOsrmDistance(origin, destination)), source: "osrm" };
  } catch (err) {
    // Last resort: built-in city table (straight line x road factor).
    const est = estimateDistance(origin, destination);
    if (est) {
      console.error(`OSRM failed (${err.message}) — using built-in city estimate`);
      return { ...est, source: "estimate" };
    }
    throw err;
  }
}

module.exports = { getDistance };
