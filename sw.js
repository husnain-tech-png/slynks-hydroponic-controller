/**
 * SLYNKS HYDROPONIC CONTROLLER - SERVICE WORKER v3.1
 * Provides offline caching, mobile app install support, and background state retention.
 */

const CACHE_NAME = 'slynks-hydroponics-v3.1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './hardware-bridge.js',
  './payments.js',
  './ai-agent.js',
  './notifications.js',
  './charts.js',
  './manifest.json',
  './assets/logo-s.svg',
  './assets/favicon.svg',
  './assets/icon-144.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable.png',
  './assets/apple-touch-icon.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Slynks SW] Caching app shell & assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event (Cache Cleanup)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Slynks SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Network first, falling back to cache)
self.addEventListener('fetch', (event) => {
  // Do not cache API endpoints or WebSockets
  if (event.request.url.includes('/api/') || event.request.url.startsWith('ws')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
