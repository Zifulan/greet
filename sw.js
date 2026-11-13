// Offline support so the page opens even without internet at midnight.
// Bump VERSION whenever files change (e.g. after adding photos).
const VERSION = 'v1';
const CACHE = 'gege-' + VERSION;
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/birthday.css',
  './assets/js/birthday.js',
  './assets/img/bg-floral.webp',
  './assets/img/bg-floral.jpg',
  './assets/img/seal-wine.webp',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/bq/orchid.webp',
  './assets/img/bq/burgundy.webp',
  './assets/img/bq/peach.webp',
  './assets/img/bq/whitemix.webp',
  './assets/img/bq/spray-a.webp',
  './assets/img/bq/spray-b.webp',
  './assets/img/bq/orchid-wine.webp',
  './assets/img/bq/anthurium-green.webp',
  './assets/img/bq/mum.webp',
  './assets/img/bq/orchid-spray.webp',
];
const FONTS = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Pinyon+Script&display=swap';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    try { // fonts: cache the stylesheet and every font file it points to
      const css = await fetch(FONTS);
      await c.put(FONTS, css.clone());
      const urls = [...(await css.text()).matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
      await Promise.all(urls.map(u => fetch(u, { mode: 'cors' }).then(r => c.put(u, r)).catch(() => {})));
    } catch {}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Network first (so updates show up), cache as fallback when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') c.put(e.request, res.clone());
      return res;
    } catch {
      return (await c.match(e.request, { ignoreSearch: true })) || (await c.match('./index.html'));
    }
  })());
});
