self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open("clearbudget-v1").then((cache) =>
      cache.addAll([
        "index.html",
        "add.html",
        "friend.html",
        "done.html",
        "transaction.html",
        "insight.html",
        "manifest.json",
        "192.png",
        "512.png",
        "https://kit.fontawesome.com/a076d05399.js",
        "https://fonts.googleapis.com/css2?family=Orbitron:wght@500&display=swap",
        "https://cdn.jsdelivr.net/npm/chart.js",
        "https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js"
      ])
    )
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
