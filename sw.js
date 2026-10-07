/* Service worker de Respira.
   Estrategia: red primero, caché como respaldo. Con conexión siempre se
   sirve la versión publicada (HTML y JSON coherentes entre sí); sin
   conexión, o si la red tarda más de NETWORK_TIMEOUT_MS, se usa la última
   copia guardada. Por eso no hace falta cambiar CACHE al publicar contenido:
   solo cuando cambia la lista PRECACHE. */
'use strict';

const CACHE = 'respira-v2';
const NETWORK_TIMEOUT_MS = 4000;
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'data/techniques.json',
  'data/locales/es.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/shortcut-repeat.png',
  'icons/shortcut-sigh.png',
  'icons/shortcut-sleep.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('respira-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  // Las navegaciones (#/tecnica/…, ?utm=…) se guardan y buscan como la raíz.
  const key = request.mode === 'navigate' ? './' : request;
  // 'no-cache' revalida con el servidor (respuesta 304 si no cambió) en vez de
  // reutilizar la caché HTTP: así el HTML y los JSON siempre llegan a la par.
  const network = fetch(new Request(request, { cache: 'no-cache' })).then((res) => {
    if (res.ok && res.type === 'basic') cache.put(key, res.clone());
    return res;
  });
  network.catch(() => {}); // Si se responde desde la caché, el fallo de red no debe quedar sin manejar.
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(resolve, NETWORK_TIMEOUT_MS); });
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
  } catch (e) { /* sin red: se usa la caché */ } finally {
    clearTimeout(timer);
  }
  const cached = await cache.match(key, { ignoreSearch: true });
  if (cached) return cached;
  return network; // Nada en caché: se espera a la red (o se propaga el error).
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});
