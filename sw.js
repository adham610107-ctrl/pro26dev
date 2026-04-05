const CACHE_NAME = 'pro-exam-v7.5-cache';

// Sayt ochilishi uchun kerak bo'lgan barcha fayllar ro'yxati
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/logo.png',
  '/bino.png',
  '/tg.png',
  '/insta.png',
  '/musiqa_nazariyasi.json',
  '/cholgu_ijrochiligi.json',
  '/vokal_ijrochiligi.json',
  '/metodika_repertuar.json'
];

// O'rnatish jarayonida fayllarni keshga yuklash
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Kesh xotira muvaffaqiyatli ochildi');
        return cache.addAll(urlsToCache);
      })
  );
});

// So'rovlarni (fetch) tutib olish va keshdan qaytarish
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Agar fayl keshda bor bo'lsa, o'shani qaytaradi, aks holda internetdan tortadi
        return response || fetch(event.request);
      })
  );
});

// Eski keshlarni tozalash (yangi versiya chiqqanda)
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
