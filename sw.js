/* ═══════════════════════════════════════════════════════════
   sw.js — offline support that does not trap you on an old
   build. The previous version was cache-first for everything,
   which meant a returning player kept whatever was cached the
   first time and only saw an update a load or two later (and
   never, if they were offline-ish). Now: network first for the
   app's own code, cache only as the fallback. Offline still
   works; being online always wins.
   ═══════════════════════════════════════════════════════════ */

const VERSION = 'v36';
const CACHE = `deepdelve-${VERSION}`;

const ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest', './icon.svg',
  './src/main.js', './src/pixels.js', './src/data.js', './src/world.js',
  './src/game.js', './src/ui.js', './src/juice.js', './src/save.js',
  './src/events.js', './src/audio.js', './src/meta.js',
  './fonts/Galmuri11.woff2', './fonts/Galmuri11-Bold.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Same-origin GETs go to the network first and refresh the cache
   on the way through. If the network is unavailable we fall back
   to whatever we stored, and a navigation with nothing cached
   falls back to the shell. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit =>
        hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)
      ))
  );
});

/* Let the page ask for an immediate takeover after an update. */
self.addEventListener('message', e => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});
