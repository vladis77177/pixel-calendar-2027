const CACHE_NAME = "pixel-calendar-2027-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.mobile.css",
  "./app.js",
  "./widget.html",
  "./widget.css",
  "./widget.js",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./assets/fonts/pixelify-cyrillic.woff2",
  "./assets/fonts/pixelify-latin.woff2",
  "./assets/fonts/nunito-cyrillic.woff2",
  "./assets/fonts/nunito-latin.woff2",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const fallback = await caches.match("./index.html");
          if (fallback) return fallback;
        }
        return new Response("Нет соединения", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      })
  );
});
