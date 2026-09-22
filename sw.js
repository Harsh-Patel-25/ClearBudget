const CACHE_NAME = 'clearbudget-v5';
const ASSETS = [
  '/',
  'index.html',
  'add.html',
  'friend.html',
  'done.html',
  'transaction.html',
  'insight.html',
  'extra.html',
  'setting.html',
  'admin.html',
  'login.html',
  'manifest.json',
  '192.png',
  '512.png',
  'css/theme.css',
  'css/nav.css',
  'js/auth.js',
  'js/api.js',
  'js/toast.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Ignore non-GET requests
  if (e.request.method !== 'GET') return;

  // Network-First strategy for all GET requests (API calls & static assets)
  // Ensures mobile & desktop browsers ALWAYS get the latest hosted version when online
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Clone and cache the fresh network response if valid
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if network is unavailable (offline mode)
        return caches.match(e.request);
      })
  );
});

