/* Service worker Kerja Harian
   Strategi: berkas milik sendiri dilayani dari cache dulu (cepat, jalan offline), lalu diperiksa ke server di belakang layar.
   Pemeriksaan memakai ETag, jadi kalau index.html tidak berubah server cukup membalas 304 dan tidak mengunduh ulang 4-5 MB.
   Ganti VERSI hanya kalau daftar berkas di bawah berubah. Kalau cuma index.html yang diganti, tidak perlu. */
const VERSI='kerjaharian-v1';
const INTI=['./','index.html','manifest.webmanifest'];
const PENDUKUNG=['icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png','fonts/fonts.css','fonts/bricolage-grotesque-latin.woff2','fonts/plus-jakarta-sans-latin.woff2','fonts/jetbrains-mono-latin.woff2','vendor/xlsx.full.min.js'];
self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(VERSI);
    await c.addAll(INTI);                                   // wajib berhasil
    await Promise.allSettled(PENDUKUNG.map(u=>c.add(u)));   // sisanya sebisanya
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const ks=await caches.keys();
    await Promise.all(ks.filter(k=>k.startsWith('jejakkerja-')&&k!==VERSI).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
async function kabari(){
  const cs=await self.clients.matchAll({type:'window'});
  cs.forEach(c=>c.postMessage({type:'update'}));
}
async function layani(req){
  const c=await caches.open(VERSI);
  const nav=req.mode==='navigate';
  const key=nav?'index.html':req;
  const ada=await c.match(key,{ignoreSearch:true});
  const segar=fetch(nav?'index.html':req,{cache:'no-cache'}).then(async res=>{
    if(res&&res.ok&&res.type==='basic'){
      const lama=ada&&ada.headers.get('etag'),baru=res.headers.get('etag');
      await c.put(key,res.clone());
      if(ada&&lama&&baru&&lama!==baru)kabari();
    }
    return res;
  }).catch(()=>null);
  if(ada){segar.catch(()=>{});return ada}
  const res=await segar;
  if(res)return res;
  if(nav){const f=await c.match('index.html');if(f)return f}
  return new Response('Offline',{status:503,statusText:'Offline'});
}
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin!==location.origin)return;   // Google Drive, login Google, dll. langsung ke jaringan
  e.respondWith(layani(r));
});
