/**
 * walmart.js
 *
 * Adapter for Walmart store locations.
 *
 * Walmart's live inventory APIs (store-near-location, geo-store-picker) are
 * blocked by Cloudflare Bot Management on server-side Node.js requests.
 * Store discovery uses a bundled local database (walmart-stores.json, built
 * from simplemaps.com data) and proximity is computed with haversine math.
 *
 * Each store result includes a storeUrl that links directly to a Walmart
 * in-store pickup search for nee-doh, so the user can check stock in their
 * browser where Cloudflare allows the request.
 */

const path  = require("path");
const cache = require("./cache");

const CACHE_TTL_SECONDS = 300;

const ALL_STORES = require(path.join(__dirname, "walmart-stores.json"));

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

/**
 * Find nearby Walmart stores using the local store database.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusMiles
 * @param {number} limit
 * @returns {Array} Store objects: { storeId, name, address, distance, city, state, lat, lng }
 */
function findNearbyStores(lat, lng, radiusMiles = 25, limit = 10) {
  const stores = [];
  for (const store of ALL_STORES) {
    const distance = haversineMiles(lat, lng, store.lat, store.lng);
    if (distance <= radiusMiles) {
      stores.push({ ...store, distance: parseFloat(distance.toFixed(1)) });
    }
  }
  return stores
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

/**
 * Find nearby Walmart stores with a direct link to check nee-doh stock.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {Array}  products  (unused — kept for API compatibility with index.js)
 * @param {number} radiusMiles
 * @returns {Array} Store objects with { products: [], storeUrl, inventoryBlocked: true }
 */
function findStoresWithInventory(lat, lng, products, radiusMiles = 25) {
  const cacheKey = `walmart:stores:${lat.toFixed(3)},${lng.toFixed(3)}:${radiusMiles}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  const stores = findNearbyStores(lat, lng, radiusMiles);

  const results = stores.map(store => ({
    ...store,
    products:         [],
    source:           "walmart-local",
    chain:            "walmart",
    inventoryBlocked: true,
    // Link to a Walmart nee-doh search filtered by city — user's browser will
    // show local pickup availability correctly
    storeUrl: `https://www.walmart.com/search?q=nee+doh&pickupStore=true&affinityOverride=${encodeURIComponent(store.city + ", " + store.state)}`,
  }));

  cache.set(cacheKey, results, CACHE_TTL_SECONDS);
  return results;
}

module.exports = { findNearbyStores, findStoresWithInventory };
