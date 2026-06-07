/* sw.js */

const CACHE_NAME = 'budget-v1';
const ASSETS = [
  './',
  './index.html',
  './css/variables.css',
  './css/styles.css',
  './js/db.js',
  './js/charts.js',
  './js/ui.js',
  './js/app.js',
  './manifest.json'
];

// Install event: cache application core resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Caching App Shell');
      const cachePromises = ASSETS.map(asset => {
        return cache.add(asset).catch(err => {
          console.warn(`Service Worker: Failed to cache shell asset: ${asset}`, err);
        });
      });
      return Promise.all(cachePromises);
    })
  );
  self.skipWaiting();
});

// Activate event: clean up outdated cache structures
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: network first, fallback to cache
self.addEventListener('fetch', event => {
  // Only intercept HTTP/HTTPS GET requests (prevent caching chrome-extension/data/etc scheme issues)
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // If response is valid, update local cache in background
        if (networkResponse && networkResponse.status === 200) {
          const responseCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseCopy);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline: attempt to retrieve from cache
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If the resource is not in cache, let the browser handle standard failure
        });
      })
  );
});
