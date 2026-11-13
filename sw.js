// Offline support so the page opens even without internet at midnight.
// Bump VERSION whenever files change (e.g. after adding photos).
const VERSION = 'v4';
const CACHE = 'gege-' + VERSION;
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/birthday.css',
  './assets/js/birthday.js',
  './assets/img/bg-floral.webp',
  './assets/img/bg-floral.jpg',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/bq/orchid.webp',
  './assets/img/bq/burgundy.webp',
  './assets/img/bq/peach.webp',
  './assets/img/bq/whitemix.webp',
  './assets/photos/sd-fatah.webp',
  './assets/photos/sd-gege.webp',
];
const OPTIONAL = ['./assets/audio/night-changes.mp3']; // cached if present
const FONTS = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Cormorant+Garamond:wght@500;600&family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Pinyon+Script&display=swap';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    await Promise.all(OPTIONAL.map(u => fetch(u).then(r => r.status === 200 && c.put(u, r)).catch(() => {})));
    try { // fonts: the stylesheet and every font file it points to
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
      if (res.status === 200 || res.type === 'opaque') c.put(e.request, res.clone()).catch(() => {});
      return res;
    } catch {
      return (await c.match(e.request, { ignoreSearch: true })) || (await c.match('./index.html'));
    }
  })());
});
