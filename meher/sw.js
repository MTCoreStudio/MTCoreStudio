/* MT Admin service worker: makes the admin installable and fast. It NEVER caches api.php or the admin HTML (always fresh, always logged-in state). */
const V = "mt-admin-v1", SHELL = ["admin.css?v=4", "admin.js?v=4", "pwa-192.png", "pwa-512.png"];
const OFFLINE = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Offline</title><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#030712;color:#e8eefc;font:16px system-ui;text-align:center;padding:24px"><div><h1 style="margin:0 0 8px">You're offline</h1><p style="color:#8da0c8">The admin needs an internet connection.</p><button onclick="location.reload()" style="padding:12px 22px;border-radius:12px;border:0;background:#4facfe;color:#031026;font-weight:700">Try again</button></div>`;
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())) });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())) });
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.endsWith("/api.php")) return;   // network only
  if (r.mode === "navigate") { e.respondWith(fetch(r).catch(() => new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } }))); return }
  if (/\.(css|js|png|svg|webp|jpg)$/.test(u.pathname)) {   // stale-while-revalidate for static files
    e.respondWith(caches.open(V).then(c => c.match(r, { ignoreSearch: false }).then(hit => {
      const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res }).catch(() => hit);
      return hit || net;
    })));
  }
});
