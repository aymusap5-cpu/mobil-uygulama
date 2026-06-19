const ONBELLEK_ADI = 'dosya-arsivim-v2'; // Versiyonu v2 yaptık ki telefon güncellemeyi fark etsin
const ONBELLEKLENECEKLER = [
  '/mobil-uygulama/',
  '/mobil-uygulama/index.html',
  '/mobil-uygulama/style.css',
  '/mobil-uygulama/app.js',
  '/mobil-uygulama/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
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

// Fetch: önce önbellekten sun, yoksa ağdan al
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((onbellekCevabi) => {
      if (onbellekCevabi) return onbellekCevabi;
      return fetch(event.request).catch(() => {
        // Ağ yoksa ve önbellekte de yoksa
        return new Response('Çevrimdışısınız ve bu kaynak önbellekte yok.', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      });
    })
  );
});