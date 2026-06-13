const CACHE_NAME = "bothbook-shell-v4";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./reader.html",
  "./invest.html",
  "./investment.html",
  "./research/",
  "./research/index.html",
  "./stocks/",
  "./stocks/index.html",
  "./stocks/market-library.css",
  "./stocks/market-library.js",
  "./stocks/thai/",
  "./stocks/thai/index.html",
  "./stocks/us/",
  "./stocks/us/index.html",
  "./stocks/japan/",
  "./stocks/japan/index.html",
  "./stocks/china/",
  "./stocks/china/index.html",
  "./manifest.webmanifest",
  "./assets/icons/icon.svg",
  "./assets/mascot-panda.png",
  "./assets/icons/panda-favicon-32.png",
  "./assets/icons/panda-icon-192.png",
  "./assets/icons/panda-icon-512.png",
  "./assets/icons/panda-maskable-192.png",
  "./assets/icons/panda-maskable-512.png",
  "./assets/icons/panda-apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (url.origin === self.location.origin) {
    if (event.request.mode === "navigate" || event.request.destination === "document") {
      event.respondWith(
        fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
      );
      return;
    }

    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(response => {
          if (!response.ok) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        }).catch(() => caches.match("./index.html"))
      )
    );
  }
});
