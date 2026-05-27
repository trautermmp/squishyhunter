/**
 * products.js
 * 
 * Master product catalog for SquishFinder.
 * 
 * TCINs pulled directly from Target product URLs — the number after /A- in any
 * target.com product URL is the TCIN used to query the RedSky inventory API.
 * 
 * Walmart item IDs are from the /ip/.../XXXXXXXX path on walmart.com.
 * 
 * To add a product: find it on target.com or walmart.com, grab the ID from the URL,
 * and add an entry below.
 */

const PRODUCTS = [
  // ─── Nee-Doh Classic / Groovy Glob ───────────────────────────────────────────
  {
    id: "needoh-classic",
    name: "Nee-Doh Groovy Glob (Classic)",
    brand: "Schylling",
    category: "needoh",
    emoji: "🟢",
    target_tcin: "14278220",
    walmart_item_id: "803441729",
    upc: "019649108109",
    msrp: 4.99,
    image: null,
  },
  {
    id: "needoh-gummy-bear",
    name: "Nee-Doh Gummy Bear",
    brand: "Schylling",
    category: "needoh",
    emoji: "🐻",
    target_tcin: "1003290238",
    walmart_item_id: null,
    upc: "019649108284",
    msrp: 6.99,
    image: null,
  },
  {
    id: "needoh-nice-berg",
    name: "Nee-Doh Nice Berg",
    brand: "Schylling",
    category: "needoh",
    emoji: "🧊",
    target_tcin: "1003474215",
    walmart_item_id: null,
    upc: "019649108246",
    msrp: 6.99,
    image: null,
  },
  {
    id: "needoh-nice-cube-candy-swirl",
    name: "Nee-Doh Candy Swirl Nice Cube",
    brand: "Schylling",
    category: "needoh",
    emoji: "🍭",
    target_tcin: "1008550423",
    walmart_item_id: null,
    upc: null,
    msrp: 6.99,
    image: null,
  },
  {
    id: "needoh-dohnut-hole-4pk",
    name: "Nee-Doh Dohnut Hole 4-Pack",
    brand: "Schylling",
    category: "needoh",
    emoji: "🍩",
    target_tcin: "1008622138",
    walmart_item_id: null,
    upc: null,
    msrp: 12.99,
    image: null,
  },
  {
    id: "needoh-teenie-swirl-4pk",
    name: "Nee-Doh Teenie Swirl 4-Pack",
    brand: "Schylling",
    category: "needoh",
    emoji: "🌀",
    target_tcin: "1008622136",
    walmart_item_id: null,
    upc: null,
    msrp: 9.99,
    image: null,
  },
  {
    id: "needoh-teenie-fuzz-ball-4pk",
    name: "Nee-Doh Teenie Fuzz Ball 4-Pack",
    brand: "Schylling",
    category: "needoh",
    emoji: "🟣",
    target_tcin: "1008622137",
    walmart_item_id: null,
    upc: null,
    msrp: 9.99,
    image: null,
  },
  {
    id: "needoh-squishmas-4pk",
    name: "Nee-Doh Squishmas Squishkins 4-Pack",
    brand: "Schylling",
    category: "needoh",
    emoji: "⭐",
    target_tcin: "1010094671",
    walmart_item_id: null,
    upc: null,
    msrp: 12.99,
    image: null,
  },

  // ─── Squishmallows ────────────────────────────────────────────────────────────
  {
    id: "squishmallow-8in",
    name: "Squishmallows 8-inch (assorted)",
    brand: "Jazwares",
    category: "squishmallow",
    emoji: "🌸",
    target_tcin: null,
    walmart_item_id: null,
    upc: null,
    msrp: 13.99,
    image: null,
    keyword_search: "squishmallow 8 inch",
  },
];

/**
 * Returns all TCINs as a comma-separated string for bulk Target API calls.
 */
function getAllTargetTcins() {
  return PRODUCTS
    .filter(p => p.target_tcin)
    .map(p => p.target_tcin)
    .join(",");
}

/**
 * Returns all Walmart item IDs for bulk Walmart lookups.
 */
function getAllWalmartItemIds() {
  return PRODUCTS
    .filter(p => p.walmart_item_id)
    .map(p => p.walmart_item_id);
}

/**
 * Returns a product by its TCIN.
 */
function getProductByTcin(tcin) {
  return PRODUCTS.find(p => p.target_tcin === String(tcin)) || null;
}

/**
 * Returns a product by its Walmart item ID.
 */
function getProductByWalmartId(itemId) {
  return PRODUCTS.find(p => p.walmart_item_id === String(itemId)) || null;
}

module.exports = {
  PRODUCTS,
  getAllTargetTcins,
  getAllWalmartItemIds,
  getProductByTcin,
  getProductByWalmartId,
};
