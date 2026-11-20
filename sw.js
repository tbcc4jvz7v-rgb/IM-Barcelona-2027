const CACHE='ironman-barcelona-amended-bricks-v7';
const ASSETS=['./','./index.html','./app.js','./training-plan.json','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ironman-barcelona-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(req.mode==='navigate'||/\/(app\.js|index\.html|training-plan\.json)$/.test(new URL(req.url).pathname)){
      try{const result=await fetch(req);if(result.ok)cache.put(req,result.clone());return result;}catch(err){return await cache.match(req)||await cache.match('./index.html')||Response.error();}
    }
    const cached=await cache.match(req);if(cached)return cached;
    try{const result=await fetch(req);if(result.ok)cache.put(req,result.clone());return result;}catch(err){return Response.error();}
  })());
});
