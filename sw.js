const CACHE_NAME = 'clearbudget-v3';
const ASSETS = [
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
  // Cache-first for local assets, network-first for API calls
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((res) => res || fetch(e.request))
    );
  }
});
