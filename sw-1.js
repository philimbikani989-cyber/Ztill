// ZedTill service worker: caches the app shell and its CDN dependencies
// so the app (including camera scanning and Excel export) keeps working
// with no internet after the first successful load.

const CACHE_NAME = 'zedtill-cache-v2';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Cache-first: serve from cache immediately if available (fast, works
// offline), and quietly refresh the cache in the background when online
// so updates still reach the device eventually.
//
// IMPORTANT: only intercepts GET requests. POST requests (the sync
// calls to Apps Script) are left completely alone and handled natively
// by the browser. The Cache API cannot store POST request/response
// pairs, and earlier this handler tried to anyway, which could make a
// successful sync appear to fail on the page's end. That triggered a
// retry, and Apps Script has no deduplication, so retried sends showed
// up as duplicate rows in the sheet.
self.addEventListener('fetch', (event) => {
  if(event.request.method !== 'GET'){
    return; // do not call respondWith, browser handles this request as normal
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
