// Offline support so the page opens even without internet at midnight.
// Bump VERSION whenever files change (e.g. after adding photos).
const VERSION = 'v7';
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
  './assets/img/art/cloud-day-1.webp',
  './assets/img/art/cloud-day-2.webp',
  './assets/img/art/cloud-day-3.webp',
  './assets/img/art/cloud-rose-1.webp',
  './assets/img/art/cloud-rose-2.webp',
  './assets/img/art/cloud-rose-3.webp',
  './assets/img/art/divider-1.svg',
  './assets/img/art/divider-2.svg',
  './assets/img/art/doodle-backpack.svg',
  './assets/img/art/doodle-calendar.svg',
  './assets/img/art/doodle-dream.svg',
  './assets/img/art/doodle-heart.svg',
  './assets/img/art/doodle-pencil.svg',
  './assets/img/art/doodle-speech.svg',
  './assets/img/art/doodle-tie.svg',
  './assets/img/art/dream-haze.webp',
  './assets/img/art/moon.webp',
  './assets/img/art/petal-1.webp',
  './assets/img/art/petal-2.webp',
  './assets/img/art/petal-3.webp',
  './assets/img/art/petal-4.webp',
  './assets/img/art/petal-5.webp',
  './assets/img/art/petal-6.webp',
  './assets/img/art/petal-7.webp',
  './assets/img/art/petal-8.webp',
  './assets/img/art/sparkle-1.webp',
  './assets/img/art/sparkle-2.webp',
  './assets/img/art/sparkle-3.webp',
  './assets/img/art/sugar-rose-1.webp',
  './assets/img/art/sugar-rose-2.webp',
  './assets/img/art/sugar-rose-3.webp',
  './assets/img/art/sugar-rose-4.webp',
  './assets/img/art/sun.webp',
  './assets/img/art/tape-brown.webp',
  './assets/img/art/tape-burgundy.webp',
  './assets/img/art/tape-cream.webp',
  './assets/img/art/tape-green.webp',
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
