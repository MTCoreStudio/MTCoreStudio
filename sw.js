/* ---------------------------------------------------------------------------
 * MT Core Studio - service worker (progressive enhancement only)
 *
 * The website works perfectly without this file. The worker only adds an
 * install prompt (PWA) and offline support after the visitor has loaded the
 * site once.
 *
 * When you deploy a major update, bump CACHE to a new name (e.g. v2) so old
 * caches are replaced instead of lingering.
 * ------------------------------------------------------------------------- */

const CACHE = "mt-core-studio-v5";
const ROOT = "./";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          ROOT,
          "./index.html",
          "./terms.html",
          "./404.html",
          "./css/style.css",
          "./js/main.js",
          "./assets/images/mt-core-studio-logo.png",
          "./assets/images/favicon.svg",
        ])
      )
      .catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Data (data/*.js), the APIs and the site script change with every admin
  // save - they must never be served from a stale cache, otherwise an app
  // status or policy edit takes hours/days to show up (the original bug).
  const isLiveData =
    url.pathname.includes("/data/") ||
    url.pathname.includes("/api/") ||
    url.pathname.includes("/js/");

  // Pages: network first, fall back to the cached copy, then to index.html.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-cache" })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((hit) => {
            if (hit) return hit;
            return caches.match(ROOT).then((root) => root || caches.match("./index.html"));
          })
        )
    );
    return;
  }

  // Live data always goes to the network first with revalidation forced
  // (cache: "no-cache" bypasses the HTTP cache), refreshes the stored copy,
  // and only falls back to the cached copy when offline.
  if (isLiveData) {
    event.respondWith(
      fetch(request, { cache: "no-cache" })
        .then((response) => {
          const copy = response.clone();
          if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Everything else: cache first, then network and store the fresh copy.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request)
          .then((response) => {
            const copy = response.clone();
            if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => hit)
    )
  );
});
