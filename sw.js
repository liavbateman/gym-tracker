// Offline support: always try the network first so updates show up right away; fall back to the cache when offline.
const CACHE = 'gym-tracker-v11';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.json', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/fonts.css', 'fonts/ibm-400-hebrew.woff2', 'fonts/ibm-400-latin.woff2', 'fonts/ibm-500-hebrew.woff2', 'fonts/ibm-500-latin.woff2',
  'fonts/ibm-700-hebrew.woff2', 'fonts/ibm-700-latin.woff2', 'fonts/karantina-400-hebrew.woff2', 'fonts/karantina-400-latin.woff2',
  'fonts/karantina-700-hebrew.woff2', 'fonts/karantina-700-latin.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        // no-cache: revalidate with the server instead of trusting the browser's HTTP cache.
        const res = await fetch(e.request, { cache: 'no-cache' });
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      } catch {
        return (await cache.match(e.request, { ignoreSearch: true })) || Response.error();
      }
    })
  );
});
