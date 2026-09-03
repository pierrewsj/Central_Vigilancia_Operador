const CACHE_NAME = 'central-gsp-operacao-v13-parte-1';
const APP_FILES = ['./','./index.html','./styles.css','./app.js','./config.js','./manifest.json','./icon-192.png','./icon-512.png','./bot-avatar-real.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', event => { const url = new URL(event.request.url); if (url.origin.includes('script.google.com')) return; event.respondWith(fetch(event.request).then(response => { const copy=response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(res => res || caches.match('./index.html')))); });
