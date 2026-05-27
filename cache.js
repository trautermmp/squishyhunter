/**
 * cache.js
 * 
 * Simple in-memory TTL cache. Keeps API hammering to a minimum.
 * Production upgrade: swap this for Redis.
 */

const store = new Map();

/**
 * Set a cache entry with a TTL in seconds.
 */
function set(key, value, ttlSeconds = 300) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Get a cache entry. Returns null if missing or expired.
 */
function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Delete a specific key.
 */
function del(key) {
  store.delete(key);
}

/**
 * Evict all expired entries (run on an interval).
 */
function evict() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(key);
  }
}

// Auto-evict every 5 minutes
setInterval(evict, 5 * 60 * 1000);

module.exports = { set, get, del };
