// Free, no-API-key road distance: OpenStreetMap Nominatim (place name →
// coordinates) + the OSRM routing service (coordinates → driving distance).
//
// Both default to the free public servers, which are fine for testing and
// small sites but come with NO uptime guarantee and a fair-use policy:
//   - Nominatim: max 1 request/second, must send an identifying User-Agent
//     (https://operations.osmfoundation.org/policies/nominatim/)
//   - OSRM demo server: light use only (https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy)
// For real traffic, self-host either one and point these env vars at yours:
//   OSRM_BASE_URL, NOMINATIM_BASE_URL.  NOMINATIM_USER_AGENT should name your
//   site + a contact email. NOMINATIM_COUNTRY_CODES narrows geocoding
//   (default "in" — India; set empty to search worldwide).
//
// Results are cached (geocodes and routes never really change), which keeps
// us well inside those limits: each unique place is looked up once.

const OSRM_BASE = (process.env.OSRM_BASE_URL || "https://router.project-osrm.org").replace(/\/$/, "");
const NOMINATIM_BASE = (process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org").replace(/\/$/, "");
const USER_AGENT = process.env.NOMINATIM_USER_AGENT || "AverraCabs/1.0 (set NOMINATIM_USER_AGENT with your contact email)";
const COUNTRY_CODES =
  process.env.NOMINATIM_COUNTRY_CODES !== undefined ? process.env.NOMINATIM_COUNTRY_CODES : "in";

const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const geoCache = new Map(); // normalized place → {lat, lon, expiresAt}

// Serialize + space out Nominatim calls (policy: max 1 req/sec).
let nominatimQueue = Promise.resolve();
function throttledNominatim(fn) {
  const run = nominatimQueue.then(fn);
  nominatimQueue = run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, 1100)));
  return run;
}

async function geocode(place) {
  const key = place.trim().toLowerCase();
  const hit = geoCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit;

  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set("q", place);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  if (COUNTRY_CODES) url.searchParams.set("countrycodes", COUNTRY_CODES);

  const data = await throttledNominatim(async () => {
    // Re-check: another queued request may have filled the cache meanwhile.
    const again = geoCache.get(key);
    if (again && again.expiresAt > Date.now()) return again;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const e = new Error(`Nominatim returned ${res.status}`);
      e.code = "UPSTREAM_ERROR";
      throw e;
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      const e = new Error(`Could not find "${place}" on the map`);
      e.code = "NO_ROUTE";
      throw e;
    }
    return { lat: Number(rows[0].lat), lon: Number(rows[0].lon) };
  });

  const value = { lat: data.lat, lon: data.lon, expiresAt: Date.now() + TTL_MS };
  geoCache.set(key, value);
  return value;
}

function formatDuration(seconds) {
  const mins = Math.max(1, Math.round(seconds / 60));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min${m === 1 ? "" : "s"}`;
  return `${h} hour${h === 1 ? "" : "s"}${m ? ` ${m} min${m === 1 ? "" : "s"}` : ""}`;
}

/** Returns { distanceKm, durationText } (driving route) or throws. */
const routeCache = new Map();

async function getOsrmDistance(origin, destination) {
  const rkey = `${origin.trim().toLowerCase()}|${destination.trim().toLowerCase()}`;
  const cachedRoute = routeCache.get(rkey);
  if (cachedRoute && cachedRoute.expiresAt > Date.now()) return cachedRoute.value;
  const a = await geocode(origin);
  const b = await geocode(destination);

  // OSRM wants lon,lat order.
  const url = `${OSRM_BASE}/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    const e = new Error(`OSRM returned ${res.status}`);
    e.code = "UPSTREAM_ERROR";
    throw e;
  }
  const data = await res.json();
  const route = data.routes && data.routes[0];
  if (data.code !== "Ok" || !route) {
    const e = new Error(`No driving route found between "${origin}" and "${destination}"`);
    e.code = "NO_ROUTE";
    throw e;
  }
  const value = {
    distanceKm: Math.round(route.distance / 1000),
    durationText: formatDuration(route.duration),
  };
  routeCache.set(rkey, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

module.exports = { getOsrmDistance };
