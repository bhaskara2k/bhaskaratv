const CACHE_NAME = 'bhaskara-tv-v1';
const assetsToCache = [
    '/',
    '/index.html',
    '/app.js',
    '/schedule.json',
    'https://cdn.tailwindcss.com'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(assetsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
