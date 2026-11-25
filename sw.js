/* Service worker de La Cuisine de Halmoni (généré par build.py, version 3039875222) */
const CACHE = "halmoni-3039875222";
const SOCLE = ["./", "index.html", "recettes.html", "frigo.html", "ingredients.html", "hors-ligne.html", "application.html", "manifest.webmanifest", "mes-recettes.html", "assets/style.css", "assets/app.js", "assets/favicon.svg", "assets/icon-192.png", "assets/fonts/league-spartan-latin-700-normal.woff2", "assets/fonts/figtree-latin-400-normal.woff2", "assets/fonts/figtree-latin-600-normal.woff2"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SOCLE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("halmoni-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;   // avis, carte, etc. : jamais mis en cache
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); if (r.ok) caches.open(CACHE).then(c => c.put(req, copy)); return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("hors-ligne.html"))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
