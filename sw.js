const ONBELLEK_ADI = 'dosya-arsivim-v2';
const ONBELLEKLENECEKLER = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Kurulum: dosyaları önbelleğe al
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ONBELLEK_ADI).then((cache) => {
      return cache.addAll(ONBELLEKLENECEKLER);
    })
  );
  self.skipWaiting();
});

// Aktivasyon: eski önbellekleri temizle
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((anahtarlar) => {
      return Promise.all(
        anahtarlar
          .filter((key) => key !== ONBELLEK_ADI)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: kendi dosyalar önbellekten, CDN dosyaları ağdan (ağ yoksa önbellekten)
self.addEventListener('fetch', (event) => {
  const istekUrl = new URL(event.request.url);
  const kendiSite = istekUrl.origin === self.location.origin;

  if (kendiSite) {
    // Kendi dosyalar: önce önbellek, yoksa ağ
    event.respondWith(
      caches.match(event.request).then((onbellekCevabi) => {
        if (onbellekCevabi) return onbellekCevabi;
        return fetch(event.request).then((agCevabi) => {
          return caches.open(ONBELLEK_ADI).then((cache) => {
            cache.put(event.request, agCevabi.clone());
            return agCevabi;
          });
        });
      }).catch(() => new Response('Çevrimdışısınız.', { status: 503 }))
    );
  } else {
    // CDN dosyaları (pdf.js, mammoth): önce ağ, yoksa önbellek
    event.respondWith(
      fetch(event.request).then((agCevabi) => {
        caches.open(ONBELLEK_ADI).then((cache) => cache.put(event.request, agCevabi.clone()));
        return agCevabi;
      }).catch(() => caches.match(event.request))
    );
  }
});