const CACHE_NAME = 'westville-portal-v5';

// Static core assets to pre-cache for offline shell
const PRECACHE_ASSETS = [
  '/',
  '/css/global.css',
  '/css/index.css',
  '/js/qr-generator.js',
  '/js/components.js',
  '/js/index.js',
  '/images/w-pin.svg',
  '/images/compass.svg',
  '/images/my-location.svg',
  '/images/map-pin.svg',
  '/images/search.svg',
  '/favicon.ico',
  '/site.webmanifest'
];

// Install Event: Pre-cache static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Some assets failed to precache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old cache storage versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event:
// 1. Skip non-GET requests, API calls, dynamic GeoJSON data, and version.json
// 2. Network-First with Cache Fallback for navigation & app shell assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Allow live network & ETag revalidation for APIs, dynamic data files, and version info
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/data/') ||
    url.pathname === '/version.json'
  ) {
    return;
  }

  // Network-First with Cache Fallback for first-party assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
});

