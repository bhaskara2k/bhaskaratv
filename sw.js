const CACHE_NAME = 'bhaskara-tv-v3';
const assetsToCache = [
    '/',
    'index.html',
    'app.js',
    'pwa-icon.png',
    'manifest.json'
];

// Lista de domínios externos que NUNCA devem ser interceptados pelo SW
const BYPASS_DOMAINS = [
    'archive.org',
    'firestore.googleapis.com',
    'firebase.googleapis.com',
    'googleapis.com',
    'firebaseapp.com',
    'gstatic.com',
    'youtube.com',
    'googlevideo.com'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(assetsToCache))
            .catch(err => console.warn('[SW] Falha ao cachear assets:', err))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
        ))
    );
    // Assume controle imediato de todos os clientes
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // REGRA 1: Requisições não-GET (POST, etc.) nunca são cacheadas
    if (event.request.method !== 'GET') {
        return; // Deixa passar normalmente
    }

    // REGRA 2: Domínios externos (vídeos, Firebase) passam direto — sem interceptação
    const isBypass = BYPASS_DOMAINS.some(domain => url.hostname.includes(domain));
    if (isBypass) {
        return; // CRÍTICO: Não interceptar. Deixa o browser resolver.
    }

    // REGRA 3: Para assets locais, usa Cache-First com fallback para rede
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            // Tenta buscar da rede com tratamento de erro
            return fetch(event.request).catch(err => {
                console.warn('[SW] Falha ao buscar recurso local:', event.request.url, err);
                // Retorna uma resposta vazia em vez de deixar a Promise rejeitar
                return new Response('', { status: 503, statusText: 'Service Unavailable' });
            });
        })
    );
});
