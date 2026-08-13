/* Service worker: offline shell + background delivery of scheduled facts. */

importScripts('./store.js');

const CACHE = 'mlaw-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data.js',
  './store.js',
  './scheduler.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/badge.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      // A wake-up for any other reason is a chance to deliver what came due.
      .then(() => self.MLawStore.flushDue(self.registration))
  );
});

/* Cache-first for our own assets: the corpus is static and the app must work
   with no connection at all — that is the whole point of an offline law app.
   Anything cross-origin goes straight to the network, uncached. */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => caches.match('./index.html'))
    )
  );
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'mlaw-facts') {
    event.waitUntil(self.MLawStore.flushDue(self.registration));
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'mlaw-facts') {
    event.waitUntil(self.MLawStore.flushDue(self.registration));
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'flush') {
    event.waitUntil(self.MLawStore.flushDue(self.registration));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || './',
    self.location.href
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.split('#')[0] === target.split('#')[0]) {
            client.focus();
            return client.navigate(target);
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
