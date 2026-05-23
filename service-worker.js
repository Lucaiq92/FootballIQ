const CACHE_NAME = "footballiq-shell-v20";
const RUNTIME_CACHE = "footballiq-runtime-v20";

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./data.js",
  "./app.js",
  "./manifest.webmanifest",
  "./offline.html",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/logos/FIFA-Logo-2026.png",
  "./assets/players/neymar-brazil-10.jpg",
  "./assets/splash/splash-1170x2532.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith("footballiq-") || key.startsWith("homeoffootball-") || key.startsWith("mondiali7-")) &&
                ![CACHE_NAME, RUNTIME_CACHE].includes(key),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);

  if (event.request.mode === "navigate") {
    const isIndexNavigation = requestUrl.pathname === "/" || requestUrl.pathname.endsWith("/index.html");

    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (isIndexNavigation) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() => {
          if (isIndexNavigation) {
            return caches.match("./index.html").then((cached) => cached || caches.match("./offline.html"));
          }
          return caches.match(event.request).then((cached) => cached || caches.match("./offline.html"));
        }),
    );
    return;
  }

  if (requestUrl.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || Response.error())),
    );
    return;
  }

  if (event.request.destination === "image") {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response.ok || response.type === "opaque") {
              const copy = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy));
            }
            return response;
          })
          .catch(() => cached || Response.error());
      }),
    );
  }
});
