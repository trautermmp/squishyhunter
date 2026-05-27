/**
 * localstores.js
 *
 * Hand-curated independent stores known to carry squishies.
 * Add entries to local-stores.json — no code changes needed.
 *
 * Required fields per entry:
 *   storeId  — unique string, e.g. "local-2"
 *   name     — store name
 *   address  — full street address
 *   city, state, zip
 *   lat, lng — decimal coordinates (use maps.google.com or nominatim.openstreetmap.org)
 *   storeUrl — store website or Google Maps link
 */

const path  = require("path");
const cache = require("./cache");

const CACHE_TTL_SECONDS = 300;

const ALL_STORES = require(path.join(__dirname, "local-stores.json"));

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R    = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearbyStores(lat, lng, radiusMiles = 25, limit = 10) {
  const stores = [];
  for (const store of ALL_STORES) {
    const distance = haversineMiles(lat, lng, store.lat, store.lng);
    if (distance <= radiusMiles) {
      stores.push({ ...store, distance: parseFloat(distance.toFixed(1)) });
    }
  }
  return stores.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

function findStoresWithInventory(lat, lng, _products, radiusMiles = 25) {
  const cacheKey = `localstores:${lat.toFixed(3)},${lng.toFixed(3)}:${radiusMiles}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  const results = findNearbyStores(lat, lng, radiusMiles).map(store => ({
    ...store,
    products:         [],
    source:           "local",
    chain:            "local",
    inventoryBlocked: true,
  }));

  cache.set(cacheKey, results, CACHE_TTL_SECONDS);
  return results;
}

module.exports = { findNearbyStores, findStoresWithInventory };
