const CACHE_NAME = 'agenda-cap53-v3';
const PRECACHE = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Não interceptar nada fora da própria origem (ex.: API do PocketBase em outro domínio).
  if (url.origin !== self.location.origin) return;

  // Nunca interceptar streams SSE. Clonar/guardar um event-stream infinito
  // (ex.: /api/realtime) trava a conexão e gera net::ERR_FAILED.
  if ((req.headers.get('accept') || '').includes('text/event-stream')) return;

  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
