/**
 * learningexpress.js
 *
 * Adapter for Learning Express store locations.
 *
 * Learning Express is a small franchise chain (~100-200 stores). Their website
 * is behind Cloudflare, so the database is sourced from OpenStreetMap data
 * (39 stores as of May 2026). Coverage is incomplete — OSM volunteers don't
 * tag every franchise location.
 *
 * Each result links to the Learning Express store locator so the user can
 * find and contact their nearest location directly.
 *
 * To refresh: re-run the Overpass query in build-store-db docs or update
 * learningexpress-stores.json manually from learningexpress.com/locator.
 */

const path  = require("path");
const cache = require("./cache");

const CACHE_TTL_SECONDS = 300;

const ALL_STORES = require(path.join(__dirname, "learningexpress-stores.json"));

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
  const cacheKey = `learningexpress:stores:${lat.toFixed(3)},${lng.toFixed(3)}:${radiusMiles}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  const results = findNearbyStores(lat, lng, radiusMiles).map(store => ({
    ...store,
    products:         [],
    source:           "learningexpress-local",
    chain:            "learningexpress",
    inventoryBlocked: true,
    storeUrl:         "https://learningexpress.com/locator/",
  }));

  cache.set(cacheKey, results, CACHE_TTL_SECONDS);
  return results;
}

module.exports = { findNearbyStores, findStoresWithInventory };
