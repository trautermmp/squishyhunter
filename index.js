/**
 * index.js  — SquishFinder API Server
 *
 * Runs on port 3001 by default. Set PORT in .env to override.
 *
 * ROUTES
 * ──────
 * GET  /
 *   Serves the test dashboard HTML.
 *
 * GET  /health
 *
 * GET  /api/products
 *
 * GET  /api/stores?lat=&lng=&radius=
 *   Nearby stores (all chains) sorted by distance.
 *
 * GET  /api/stores/:chain?lat=&lng=&radius=
 *   Single-chain variant.
 *
 * POST /api/reports
 *   Submit a community stock sighting.
 *   Body: { storeId, storeName, chain, lat, lng, productId, qty, status, note, deviceId }
 *
 * POST /api/reports/:id/confirm
 *   Confirm an existing report is still accurate.
 *
 * GET  /api/reports?lat=&lng=&radius=
 *   Non-expired community reports near a location.
 */

require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const path      = require("path");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto    = require("crypto");

const target          = require("./target");
const walmart         = require("./walmart");
const fivebelow       = require("./fivebelow");
const learningexpress = require("./learningexpress");
const localstores     = require("./localstores");
const { PRODUCTS }    = require("./products");
const supabase        = require("./supabase");
const { sendPushForReport } = require("./push");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Security middleware ──────────────────────────────────────────────────────

app.use(helmet({
  // Allow the dashboard to load inline scripts and styles
  contentSecurityPolicy: false,
}));
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://squishyhunter.com',
  'https://www.squishyhunter.com',
  'https://squishyhunter.vercel.app',
  /^https:\/\/squishyhunter.*\.vercel\.app$/,
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server / curl
    const allowed = ALLOWED_ORIGINS.some(o =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    cb(null, allowed ? origin : false);
  },
  credentials: true,
}));
app.use(express.json({ limit: "10kb" })); // prevent oversized payloads

// ── Rate limiters ────────────────────────────────────────────────────────────

// Store/product lookups — generous limit
const apiLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             120,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: "Too many requests, please slow down." },
});

// Report submission — strict limit to discourage spam
const reportLimiter = rateLimit({
  windowMs:        60 * 60 * 1000, // 1 hour
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: "Too many reports submitted. Please wait before submitting again." },
});

// Confirm — moderate limit
const confirmLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: "Too many confirmations. Please wait." },
});

app.use("/api/stores",   apiLimiter);
app.use("/api/products", apiLimiter);

// ── Request logger ───────────────────────────────────────────────────────────

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Fallback in-memory report store (used when Supabase is not configured) ───

const crowdsourceReports = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function normalizeStatus(rawStatus) {
  if (!rawStatus) return "unknown";
  const s = rawStatus.toUpperCase();
  if (s === "IN_STOCK"    || s === "AVAILABLE") return "in_stock";
  if (s === "LIMITED_STOCK" || s === "LOW")     return "low_stock";
  return "out_of_stock";
}

function normalizeStore(raw) {
  return {
    storeId:          raw.storeId,
    chain:            raw.chain,
    name:             raw.name,
    address:          raw.address,
    distance:         raw.distance,
    lat:              raw.lat  ?? null,
    lng:              raw.lng  ?? null,
    source:           raw.source,
    storeUrl:         raw.storeUrl         || null,
    inventoryBlocked: raw.inventoryBlocked || false,
    products: (raw.products || []).map(p => ({
      id:     p.id   || p.tcin || null,
      tcin:   p.tcin || null,
      name:   p.name,
      qty:    p.qty,
      status: normalizeStatus(p.status),
      aisle:  p.aisle || null,
      price:  p.price || null,
    })),
  };
}

// Strip HTML tags and control characters, cap length
function sanitizeText(str, maxLen = 280) {
  if (!str) return null;
  return String(str)
    .replace(/<[^>]*>/g, "")   // strip tags
    .replace(/[\x00-\x1F]/g, "") // strip control chars
    .trim()
    .slice(0, maxLen) || null;
}

// One-way hash of a device ID — we store the hash, never the raw value
function hashDeviceId(raw) {
  if (!raw) return null;
  return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

function deriveStatus(qty) {
  if (qty === 0)  return "out_of_stock";
  if (qty <= 3)   return "low_stock";
  return "in_stock";
}

function dbRowToReport(row) {
  return {
    id:                row.id,
    storeId:           row.store_id,
    storeName:         row.store_name,
    chain:             row.chain,
    lat:               row.lat,
    lng:               row.lng,
    productId:         row.product_id,
    customProductName: row.custom_product_name ?? null,
    qty:               row.qty,
    status:            row.status,
    note:              row.note,
    reportedAt:        row.reported_at,
    expiresAt:         row.expires_at,
    confirmedBy:       row.confirmed_by,
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.json({ status: "ok", app: "Squishy Hunter API" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString(), v: 2 });
});

app.get("/api/products", (_req, res) => {
  res.json({ products: PRODUCTS });
});

// Returns the top custom product names submitted by users, ranked by frequency.
// Powers the suggestion chips in the "Other product" flow.
app.get("/api/products/suggestions", async (_req, res) => {
  if (!supabase) return res.json({ suggestions: [] });

  const { data, error } = await supabase
    .from("reports")
    .select("custom_product_name")
    .eq("product_id", "custom")
    .not("custom_product_name", "is", null);

  if (error) return res.json({ suggestions: [] });

  const counts = {};
  (data || []).forEach(r => {
    const name = r.custom_product_name?.trim();
    if (name) counts[name] = (counts[name] || 0) + 1;
  });

  const suggestions = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  res.json({ suggestions });
});

// ── Store routes ─────────────────────────────────────────────────────────────

app.get("/api/stores", async (req, res) => {
  const { lat, lng, radius = 25 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng are required" });

  const latitude  = parseFloat(lat);
  const longitude = parseFloat(lng);
  const miles     = parseFloat(radius);

  if (isNaN(latitude)  || latitude  < -90  || latitude  > 90)  return res.status(400).json({ error: "Invalid latitude" });
  if (isNaN(longitude) || longitude < -180 || longitude > 180) return res.status(400).json({ error: "Invalid longitude" });
  if (isNaN(miles)     || miles < 1 || miles > 100)            return res.status(400).json({ error: "radius must be between 1 and 100 miles" });

  try {
    const tcins = PRODUCTS.filter(p => p.target_tcin).map(p => p.target_tcin);

    const [targetStores, walmartStores, fivebelowStores, leStores, localStores] = await Promise.allSettled([
      target.findStoresWithInventory(latitude, longitude, tcins, miles),
      walmart.findStoresWithInventory(latitude, longitude, PRODUCTS, miles),
      fivebelow.findStoresWithInventory(latitude, longitude, PRODUCTS, miles),
      learningexpress.findStoresWithInventory(latitude, longitude, PRODUCTS, miles),
      localstores.findStoresWithInventory(latitude, longitude, PRODUCTS, miles),
    ]);

    const allStores = [
      ...(targetStores.status    === "fulfilled" ? targetStores.value    : []),
      ...(walmartStores.status   === "fulfilled" ? walmartStores.value   : []),
      ...(fivebelowStores.status === "fulfilled" ? fivebelowStores.value : []),
      ...(leStores.status        === "fulfilled" ? leStores.value        : []),
      ...(localStores.status     === "fulfilled" ? localStores.value     : []),
    ]
      .map(normalizeStore)
      .sort((a, b) => a.distance - b.distance);

    res.json({ count: allStores.length, location: { latitude, longitude }, stores: allStores, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[/api/stores]", err.message);
    res.status(500).json({ error: "Failed to fetch stores" });
  }
});

app.get("/api/stores/target", async (req, res) => {
  const { lat, lng, radius = 25 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });
  try {
    const tcins  = PRODUCTS.filter(p => p.target_tcin).map(p => p.target_tcin);
    const stores = await target.findStoresWithInventory(parseFloat(lat), parseFloat(lng), tcins, parseFloat(radius));
    res.json({ count: stores.length, stores: stores.map(normalizeStore) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/stores/walmart", async (req, res) => {
  const { lat, lng, radius = 25 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });
  try {
    const stores = await walmart.findStoresWithInventory(parseFloat(lat), parseFloat(lng), PRODUCTS, parseFloat(radius));
    res.json({ count: stores.length, stores: stores.map(normalizeStore) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/stores/fivebelow", (req, res) => {
  const { lat, lng, radius = 25 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });
  try {
    const stores = fivebelow.findStoresWithInventory(parseFloat(lat), parseFloat(lng), PRODUCTS, parseFloat(radius));
    res.json({ count: stores.length, stores: stores.map(normalizeStore) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/stores/learningexpress", (req, res) => {
  const { lat, lng, radius = 25 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });
  try {
    const stores = learningexpress.findStoresWithInventory(parseFloat(lat), parseFloat(lng), PRODUCTS, parseFloat(radius));
    res.json({ count: stores.length, stores: stores.map(normalizeStore) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Community report routes ───────────────────────────────────────────────────

/**
 * POST /api/reports
 *
 * Body fields:
 *   storeId    (required) string
 *   storeName  string
 *   chain      string
 *   lat        number  — store latitude
 *   lng        number  — store longitude
 *   productId  (required) string
 *   qty        (required) integer 0–999
 *   status     "in_stock" | "low_stock" | "out_of_stock"  (derived from qty if omitted)
 *   note       string, max 280 chars
 *   deviceId   string — anonymous device ID, stored only as a one-way hash
 */
app.post("/api/reports", reportLimiter, async (req, res) => {
  const { storeId, storeName, chain, lat, lng, productId, customProductName, qty, status, note, deviceId } = req.body;

  if (!storeId || !productId || qty === undefined) {
    return res.status(400).json({ error: "storeId, productId, and qty are required" });
  }
  if (productId === 'custom' && !customProductName?.trim()) {
    return res.status(400).json({ error: "customProductName is required when productId is 'custom'" });
  }

  const parsedQty = parseInt(qty, 10);
  if (isNaN(parsedQty) || parsedQty < 0 || parsedQty > 999) {
    return res.status(400).json({ error: "qty must be a whole number between 0 and 999" });
  }

  const parsedLat = lat !== undefined ? parseFloat(lat) : null;
  const parsedLng = lng !== undefined ? parseFloat(lng) : null;
  if (parsedLat !== null && (isNaN(parsedLat) || parsedLat < -90  || parsedLat > 90))  return res.status(400).json({ error: "Invalid latitude" });
  if (parsedLng !== null && (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180)) return res.status(400).json({ error: "Invalid longitude" });

  const validStatuses = ["in_stock", "low_stock", "out_of_stock"];
  const parsedStatus  = validStatuses.includes(status) ? status : deriveStatus(parsedQty);

  const report = {
    id:           `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    store_id:     sanitizeText(storeId,   50),
    store_name:   sanitizeText(storeName, 100) || "Unknown store",
    chain:        sanitizeText(chain,     30)  || "unknown",
    lat:          parsedLat,
    lng:          parsedLng,
    product_id:          sanitizeText(productId, 50),
    custom_product_name: productId === 'custom' ? sanitizeText(customProductName, 100) : null,
    qty:                 parsedQty,
    status:              parsedStatus,
    note:                sanitizeText(note, 280),
    device_id:    hashDeviceId(deviceId),
    reported_at:  new Date().toISOString(),
    expires_at:   new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    confirmed_by: 0,
  };

  if (supabase) {
    const { data, error } = await supabase.from("reports").insert(report).select().single();
    if (error) {
      console.error("[reports] Supabase insert error:", error.message);
      return res.status(500).json({ error: "Failed to save report" });
    }
    console.log(`[reports] saved to Supabase: ${data.store_name} / ${data.product_id} / qty=${parsedQty} / ${parsedStatus}`);
    // Fire-and-forget push — don't await so it doesn't block the response
    sendPushForReport(data).catch(e => console.error("[push]", e.message));
    return res.status(201).json({ success: true, report: dbRowToReport(data) });
  }

  // fallback: in-memory
  crowdsourceReports.unshift(report);
  if (crowdsourceReports.length > 1000) crowdsourceReports.length = 1000;
  console.log(`[reports] in-memory: ${report.store_name} / ${report.product_id} / qty=${parsedQty} / ${parsedStatus}`);
  res.status(201).json({ success: true, report: dbRowToReport(report) });
});

/**
 * POST /api/reports/:id/confirm
 * Upvote an existing report — increments confirmedBy and extends expiry by 1 hour.
 */
app.post("/api/reports/:id/confirm", confirmLimiter, async (req, res) => {
  if (supabase) {
    const { data: existing, error: fetchErr } = await supabase
      .from("reports")
      .select()
      .eq("id", req.params.id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: "Report not found" });
    if (new Date(existing.expires_at) < new Date()) return res.status(410).json({ error: "Report has expired" });

    const maxExpiry = Date.now() + 12 * 60 * 60 * 1000;
    const newExpiry = Math.min(new Date(existing.expires_at).getTime() + 60 * 60 * 1000, maxExpiry);

    const { data, error } = await supabase
      .from("reports")
      .update({ confirmed_by: existing.confirmed_by + 1, expires_at: new Date(newExpiry).toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: "Failed to confirm report" });
    console.log(`[reports] Confirmed: ${data.id} (${data.confirmed_by} confirmations)`);
    return res.json({ success: true, report: dbRowToReport(data) });
  }

  // fallback: in-memory
  const report = crowdsourceReports.find(r => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  if (new Date(report.expires_at) < new Date()) return res.status(410).json({ error: "Report has expired" });

  report.confirmed_by += 1;
  const maxExpiry = Date.now() + 12 * 60 * 60 * 1000;
  const newExpiry = Math.min(new Date(report.expires_at).getTime() + 60 * 60 * 1000, maxExpiry);
  report.expires_at = new Date(newExpiry).toISOString();

  console.log(`[reports] Confirmed: ${report.id} (${report.confirmed_by} confirmations)`);
  res.json({ success: true, report: dbRowToReport(report) });
});

/**
 * GET /api/reports?lat=&lng=&radius=
 * Returns non-expired community reports near a location, newest first.
 */
app.get("/api/reports", async (req, res) => {
  const { lat, lng, radius = 25 } = req.query;
  const now = new Date().toISOString();

  if (supabase) {
    let query = supabase
      .from("reports")
      .select()
      .gt("expires_at", now)
      .order("reported_at", { ascending: false })
      .limit(200);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: "Failed to fetch reports" });

    let reports = data.map(dbRowToReport);

    if (lat && lng) {
      const latitude  = parseFloat(lat);
      const longitude = parseFloat(lng);
      const miles     = parseFloat(radius);
      if (!isNaN(latitude) && !isNaN(longitude) && !isNaN(miles)) {
        reports = reports.filter(r =>
          r.lat !== null && r.lng !== null &&
          haversineMiles(latitude, longitude, r.lat, r.lng) <= miles
        );
      }
    }

    return res.json({ count: reports.length, reports });
  }

  // fallback: in-memory
  let reports = crowdsourceReports.filter(r => new Date(r.expires_at) > new Date());

  if (lat && lng) {
    const latitude  = parseFloat(lat);
    const longitude = parseFloat(lng);
    const miles     = parseFloat(radius);
    if (!isNaN(latitude) && !isNaN(longitude) && !isNaN(miles)) {
      reports = reports.filter(r =>
        r.lat !== null && r.lng !== null &&
        haversineMiles(latitude, longitude, r.lat, r.lng) <= miles
      );
    }
  }

  res.json({ count: reports.length, reports: reports.map(dbRowToReport) });
});

// ── Store submission routes ───────────────────────────────────────────────────

const submitLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });

app.post("/api/stores/submit", submitLimiter, async (req, res) => {
  const { name, chain, address, city, state, zip, website, lat, lng } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  const store = {
    name:    sanitizeText(name,    100),
    chain:   sanitizeText(chain,   30) || "other",
    address: sanitizeText(address, 200) || null,
    city:    sanitizeText(city,    100) || null,
    state:   sanitizeText(state,   2)   || null,
    zip:     sanitizeText(zip,     5)   || null,
    website: sanitizeText(website, 300) || null,
    lat:     lat ?? null,
    lng:     lng ?? null,
  };

  if (!supabase) return res.status(201).json({ success: true, store });

  const { data, error } = await supabase.from("store_submissions").insert(store).select().single();
  if (error) return res.status(500).json({ error: "Failed to save store" });
  res.status(201).json({ success: true, store: data });
});

app.get("/api/stores/submitted", async (req, res) => {
  const { lat, lng, radius = 25 } = req.query;
  if (!supabase) return res.json({ stores: [] });

  const { data } = await supabase.from("store_submissions").select("*");
  let stores = (data || []).map(s => ({
    storeId:   `community-${s.id}`,
    chain:     s.chain || "other",
    name:      s.name,
    address:   [s.address, s.city, s.state].filter(Boolean).join(", "),
    lat:       s.lat,
    lng:       s.lng,
    storeUrl:  s.website || null,
    source:    "community",
    distance:  null,
    products:  [],
    inventoryBlocked: true,
    community: true,
  }));

  if (lat && lng) {
    const latitude  = parseFloat(lat);
    const longitude = parseFloat(lng);
    const miles     = parseFloat(radius);
    if (!isNaN(latitude) && !isNaN(longitude) && !isNaN(miles)) {
      stores = stores
        .filter(s => s.lat && s.lng && haversineMiles(latitude, longitude, s.lat, s.lng) <= miles)
        .map(s => ({ ...s, distance: parseFloat(haversineMiles(latitude, longitude, s.lat, s.lng).toFixed(1)) }));
    }
  }

  res.json({ stores });
});

// ── Push subscription routes ─────────────────────────────────────────────────

const pushLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });

app.post("/api/push/subscribe", pushLimiter, async (req, res) => {
  const { subscription, lat, lng } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: "subscription required" });

  if (!supabase) return res.json({ success: true }); // no-op without Supabase

  const row = {
    endpoint: subscription.endpoint,
    p256dh:   subscription.keys?.p256dh,
    auth:     subscription.keys?.auth,
    lat:      lat ?? null,
    lng:      lng ?? null,
  };

  // Upsert so re-subscribing after a page reload just updates the record
  const { error } = await supabase.from("push_subscriptions").upsert(row, { onConflict: "endpoint" });
  if (error) return res.status(500).json({ error: "Failed to save subscription" });
  res.json({ success: true });
});

app.delete("/api/push/subscribe", async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: "endpoint required" });
  if (supabase) await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  res.json({ success: true });
});

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════╗
║  SquishFinder API                    ║
║  http://localhost:${PORT}               ║
╚══════════════════════════════════════╝

Routes:
  GET  /
  GET  /health
  GET  /api/products
  GET  /api/stores?lat=&lng=&radius=
  GET  /api/stores/target?lat=&lng=
  GET  /api/stores/walmart?lat=&lng=
  GET  /api/stores/fivebelow?lat=&lng=
  GET  /api/stores/learningexpress?lat=&lng=
  POST /api/reports
  POST /api/reports/:id/confirm
  GET  /api/reports?lat=&lng=&radius=
`);
});

module.exports = app;
