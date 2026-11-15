const CACHE_NAME = "pixel-calendar-2027-v28";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.mobile.css",
  "./core.js",
  "./app.js",
  "./update.js",
  "./sync.js",
  "./series-stats.js",
  "./notifications.js",
  "./widget.html",
  "./widget.css",
  "./widget-night.css",
  "./widget.js",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./assets/fonts/pixelify-cyrillic.woff2",
  "./assets/fonts/pixelify-latin.woff2",
  "./assets/fonts/nunito-cyrillic.woff2",
  "./assets/fonts/nunito-latin.woff2",
  "./assets/fonts/tiny5.woff2",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png"
];

// Один отсутствующий файл не должен отменять установку целиком: каждый адрес
// укладывается отдельно, ошибки только пишутся в консоль.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.allSettled(
      ASSETS.map((url) => cache.add(url).catch((error) => {
        console.warn("Не удалось положить в кэш:", url, error && error.message);
      }))
    ))
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Стратегии: навигация — сначала сеть (свежий index.html и плашка обновления),
// API синхронизации не кэшируется вообще, статика — сначала кэш.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
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
          const fallback = await caches.match("./index.html");
          if (fallback) return fallback;
          return offline();
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => offline());
    })
  );
});

function offline() {
  return new Response("Нет соединения", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}
