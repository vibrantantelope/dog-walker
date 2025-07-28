const CACHE_NAME = 'dog-walk-cache-v1';
const URLS_TO_CACHE = [
  '/', 'index.html', 'style.css', 'app.js', 'manifest.json',
  'https://unpkg.com/leaflet/dist/leaflet.css',
  'https://unpkg.com/leaflet/dist/leaflet.js',
  'https://unpkg.com/leaflet-draw/dist/leaflet.draw.css',
  'https://unpkg.com/leaflet-draw/dist/leaflet.draw.js',
  'https://unpkg.com/@turf/turf/turf.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(resp => resp || fetch(event.request))
  );
});
