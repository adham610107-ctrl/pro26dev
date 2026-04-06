const CACHE_NAME = 'pro-exam-v8.0-cache';

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

// 1. O'rnatish jarayonida fayllarni keshga yuklash
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Kesh xotira muvaffaqiyatli ochildi (PRO EXAM v8.0)');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. So'rovlarni (fetch) tutib olish va keshdan tezkor qaytarish
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Agar fayl keshda bor bo'lsa, o'shani qaytaradi, aks holda internetdan tortadi
        return response || fetch(event.request);
      })
  );
});

// 3. Eski keshlarni tozalash (Yangi versiya chiqqanda xotirani to'ldirmaslik uchun)
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
