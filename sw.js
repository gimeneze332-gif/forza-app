const CACHE_NAME = "forza-v2-smart-text-calibration-1-photo-food-remote-mock-1-ux-simplification-1-today-meals-1-almonds-1-nutrition-fallback-1";

const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./nutrition.css",
  "./photo-food.css",
  "./smart-text-catalog.js",
  "./smart-text.js",
  "./photo-food-config.js",
  "./photo-food.js",
  "./nutrition-fallback.js",
  "./nutrition.js",
  "./manifest.json",
  "./img/logo-forza.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (/^(blob:|data:)/i.test(event.request.url)) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && (response.ok || response.type === "opaque")) {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, copy));
        }

        return response;
      })
      .catch(() => caches.match(event.request)
        .then(response => {
          if (response) return response;
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }

          return Response.error();
        }))
  );
});
