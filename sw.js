/* PAF Campo – service worker: app e librerie in cache, tile della mappa in cache mentre le guardi */
const CACHE = 'paf-campo-v0.3.1';
const TILES = 'paf-tiles';
const CDN = 'https://cdn.jsdelivr.net/npm/';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './PAF_rilievi.qgz'];
const LIBS = [CDN + 'sql.js@1.10.3/dist/sql-wasm.js', CDN + 'sql.js@1.10.3/dist/sql-wasm.wasm', CDN + 'leaflet@1.9.4/dist/leaflet.js',
  CDN + 'leaflet@1.9.4/dist/leaflet.css', CDN + 'docx@8.5.0/build/index.umd.js', CDN + 'proj4@2.22.0/dist/proj4.js'];
const TILE_HOSTS = /tile\.openstreetmap\.org|tile\.opentopomap\.org|arcgisonline\.com/;
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES).then(() => Promise.all(LIBS.map(u => c.add(u).catch(() => null)))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
async function tile(req) {
  const c = await caches.open(TILES); const hit = await c.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') {
      c.put(req, res.clone());
      c.keys().then(ks => { if (ks.length > 6000) ks.slice(0, ks.length - 6000).forEach(k => c.delete(k)); });
    }
    return res;
  } catch (e) { return new Response('', {status: 504}); }
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (TILE_HOSTS.test(u.hostname)) { e.respondWith(tile(req)); return; }
  if (u.origin !== location.origin && !req.url.startsWith(CDN)) return; // API QFieldCloud: sempre rete
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(r => r || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
