const CACHE = 'mcb-cache-v1';
const ASSETS = [
  'index.html','work.html','sites.html','tasks.html','calendar.html',
  'materials.html','cutting.html','reports.html','settings.html',
  'login.html','style.css','app.js','firestore.js','manifest.json'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method!=='GET'){ return; }
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp=>{
      const copy = resp.clone();
      caches.open(CACHE).then(c=>c.put(req, copy));
      return resp;
    }).catch(()=>caches.match('index.html')))
  );
});