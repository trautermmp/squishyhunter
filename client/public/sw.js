import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// Injected by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── Runtime caching ──────────────────────────────────────────────────────────

// Cache OpenStreetMap tiles (stale-while-revalidate — tiles rarely change)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open('osm-tiles-v1').then(cache =>
        cache.match(event.request).then(cached => {
          const network = fetch(event.request).then(res => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          });
          return cached || network;
        })
      )
    );
  }
});

// ── Push notifications ───────────────────────────────────────────────────────

self.addEventListener('push', function (event) {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'New Sighting!', {
      body:     data.body || 'Someone spotted squishies nearby.',
      icon:     '/pwa-192x192.png',
      badge:    '/pwa-64x64.png',
      tag:      'squishy-sighting',
      renotify: true,
      data,
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
