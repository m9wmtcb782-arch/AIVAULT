// Offline cache for the device kit. No remote origins are ever contacted.
const CACHE='grok-ncl-v7-device-e2238ca522beb061';
const ASSETS=["./", "index.html", "app.css", "app.js", "ncl-core.js", "gpu-engine.js", "sw.js", "model.json", "model.bin", "assets.json"];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(a=>new Request(a,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('grok-ncl-v7-device-')&&x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin)return;
 if(u.searchParams.has('ncl-network')){e.respondWith(fetch(e.request,{cache:'no-store'}));return;}
 e.respondWith(caches.open(CACHE).then(c=>c.match(e.request,{ignoreSearch:true}).then(hit=>{if(hit){const h=new Headers(hit.headers);h.set('X-NCL-Source','service-worker-cache');return hit.blob().then(b=>new Response(b,{status:hit.status,headers:h}));}return fetch(e.request);})));});
