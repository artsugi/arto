// Arto: membuat aplikasi tetap bisa dibuka tanpa sinyal.
// Data belanja tetap disinkronkan oleh Firebase (bukan oleh file ini).
const CACHE = 'arto-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const NETWORK_TIMEOUT_MS = 3500;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putInCache(request, response) {
  if (response && (response.ok || response.type === 'opaque')) {
    const copy = response.clone();
    caches.open(CACHE).then((c) => c.put(request, copy));
  }
  return response;
}

// File aplikasi sendiri: ambil versi terbaru dari internet, tapi kalau sinyal lambat/tidak ada, pakai salinan di HP.
function networkFirst(request) {
  return new Promise((resolve) => {
    let settled = false;
    const fromCache = () => caches.match(request, { ignoreSearch: true })
      .then((hit) => hit || caches.match('./index.html'));
    const timer = setTimeout(() => {
      fromCache().then((hit) => { if (hit && !settled) { settled = true; resolve(hit); } });
    }, NETWORK_TIMEOUT_MS);
    fetch(request)
      .then((res) => { clearTimeout(timer); putInCache(request, res); if (!settled) { settled = true; resolve(res); } })
      .catch(() => { clearTimeout(timer); fromCache().then((hit) => { if (!settled) { settled = true; resolve(hit || Response.error()); } }); });
  });
}

// Pustaka & font dari CDN (versinya dikunci): pakai salinan di HP lebih dulu.
function cacheFirst(request) {
  return caches.match(request).then((hit) => hit || fetch(request).then((res) => putInCache(request, res)));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.cache === 'no-store') return; // cek versi baru: selalu langsung ke internet
    event.respondWith(networkFirst(req));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
  }
  // Permintaan lain (Firebase, Apps Script) dibiarkan apa adanya.
});
