/**
 * target.js
 *
 * Adapter for Target's RedSky API.
 *
 * RedSky is Target's internal GraphQL aggregation layer, but several endpoints
 * accept plain HTTP GET and return JSON — no auth token required, just the
 * public API key that ships with every target.com page load.
 *
 * STORE FINDER
 * ────────────
 * Target's /v3/stores/nearby endpoint is dead (HTTP 410). Store discovery is
 * handled entirely locally: target-stores.json is a bundled snapshot of all
 * ~2,008 US Target locations (built by build-store-db.js) and proximity is
 * computed with the haversine formula. Re-run build-store-db.js periodically
 * to refresh the database when stores open or close.
 *
 * BULK FULFILLMENT (inventory for multiple TCINs at one store)
 * ─────────────────────────────────────────────────────────────
 *   GET https://redsky.target.com/redsky_aggregations/v1/web/product_summary_with_fulfillment_v1
 *       ?key=9f36aeafbe60771e321a7cc95a78140772ab3e96
 *       &tcins=1008622138,1003290238,...
 *       &store_id=1234
 *       &zip=37167
 *
 * RESPONSE SHAPE (fulfillment)
 * ────────────────────────────
 * data.product_summaries[].fulfillment.store_options[0]
 *   .location_available_to_promise_quantity  ← shelf count
 *   .in_store_only.availability_status       ← "IN_STOCK" | "OUT_OF_STOCK" | "LIMITED_STOCK"
 *
 * RATE LIMITS & ETIQUETTE
 * ───────────────────────
 * Target tolerates reasonable request rates. The proxy caches responses for
 * CACHE_TTL_SECONDS and batches all TCINs into a single call per store to
 * minimise traffic. Do not poll faster than once per 5 minutes per store.
 */

const fetch  = require("node-fetch");
const path   = require("path");
const cache  = require("./cache");

const REDSKY_KEY_PRODUCTS = "9f36aeafbe60771e321a7cc95a78140772ab3e96";
const CACHE_TTL_SECONDS   = 300; // 5 minutes

const HEADERS = {
  "User-Agent":      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  "Accept":          "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "Origin":          "https://www.target.com",
  "Referer":         "https://www.target.com/",
};

// Load the bundled store database once at startup
const ALL_STORES = require(path.join(__dirname, "target-stores.json"));

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
 * Find nearby Target stores using the local store database.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusMiles
 * @param {number} limit
 * @returns {Array} Array of store objects: { storeId, name, address, distance, zip, state, lat, lng }
 */
function findNearbyStores(lat, lng, radiusMiles = 25, limit = 10) {
  const stores = [];
  for (const store of ALL_STORES) {
    if (store.lat === null || store.lng === null) continue;
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
 * Query inventory for a list of TCINs at a specific store.
 * 
 * @param {string}   storeId   Target store ID (e.g. "1859")
 * @param {string}   zip       Store ZIP code (required by RedSky)
 * @param {string[]} tcins     Array of TCIN strings
 * @returns {Array}  Array of { tcin, name, qty, status, aisle }
 */
async function getStoreInventory(storeId, zip, tcins) {
  const cacheKey = `target:inv:${storeId}:${tcins.sort().join(",")}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = new URL(
    "https://redsky.target.com/redsky_aggregations/v1/web/product_summary_with_fulfillment_v1"
  );
  url.searchParams.set("key",      REDSKY_KEY_PRODUCTS);
  url.searchParams.set("tcins",    tcins.join(","));
  url.searchParams.set("store_id", storeId);
  url.searchParams.set("zip",      zip);
  url.searchParams.set("channel",  "WEB");

  const res  = await fetch(url.toString(), { headers: HEADERS });
  const json = await res.json();

  const summaries = json.data?.product_summaries || [];

  const results = summaries.map(product => {
    const fulfillment  = product.fulfillment || {};
    const storeOptions = fulfillment.store_options || [];
    const storeOption  = storeOptions.find(o => String(o.location_id) === String(storeId))
                      || storeOptions[0]
                      || {};

    const qty    = storeOption.location_available_to_promise_quantity ?? null;
    const status = storeOption.in_store_only?.availability_status
                || storeOption.order_pickup?.availability_status
                || (qty > 0 ? "IN_STOCK" : "OUT_OF_STOCK");

    // Store position (aisle/block) when available
    const positions = product.store_positions || [];
    const pos       = positions[0];
    const aisle     = pos ? `Aisle ${pos.aisle}${pos.block ? " · Block " + pos.block : ""}` : null;

    return {
      tcin:   String(product.tcin),
      name:   product.item?.product_description?.title || "Unknown product",
      qty:    qty !== null ? Math.max(0, qty) : null,
      status, // "IN_STOCK" | "OUT_OF_STOCK" | "LIMITED_STOCK"
      aisle,
      price:  product.price?.current_retail ?? null,
    };
  });

  cache.set(cacheKey, results, CACHE_TTL_SECONDS);
  return results;
}

/**
 * Convenience: find nearby stores and return them with a direct link to
 * check in-store availability on Target.com.
 *
 * Live inventory via Target's API is blocked by PerimeterX bot protection.
 * Until a browser-based approach is added, this returns store locations so
 * the UI can offer a direct "Check at this store" link.
 *
 * @param {number}   lat
 * @param {number}   lng
 * @param {string[]} tcins  (unused — kept for API compatibility)
 * @param {number}   radiusMiles
 * @returns {Array}  Store objects with { products: [], storeUrl, inventoryBlocked: true }
 */
function findStoresWithInventory(lat, lng, tcins, radiusMiles = 25) {
  const stores = findNearbyStores(lat, lng, radiusMiles);

  return stores.map(store => ({
    ...store,
    products:         [],
    source:           "target-local",
    chain:            "target",
    inventoryBlocked: true,
    // Deep-link to a nee-doh in-store search at this specific Target
    storeUrl: `https://www.target.com/s?searchTerm=nee+doh&fulfillment=IS&storeId=${store.storeId}`,
  }));
}

module.exports = { findNearbyStores, getStoreInventory, findStoresWithInventory };
