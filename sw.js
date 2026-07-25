// Service Worker بسيط لنظام إدارة الرحلات
// الهدف: تخزين "شكل" الصفحة (index.html + الخطوط + المكتبات) عشان تفتح فورًا حتى لو مفيش نت خالص.
// بيانات الرحلات/الحجوزات نفسها بتتخزن جوه Firestore (enablePersistence في index.html) مش هنا.

const CACHE_NAME = 'trips-app-shell-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700&display=swap'
];

self.addEventListener('install', event=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache=>{
      // نحط كل ملف لوحده عشان لو ملف واحد فشل (مثلاً بسبب الشبكة وقت التثبيت) الباقي يتسجل عادي
      return Promise.all(APP_SHELL.map(url=>
        cache.add(url).catch(err=> console.warn('SW: تعذر تخزين', url, err))
      ));
    }).then(()=> self.skipWaiting())
  );
});

self.addEventListener('activate', event=>{
  event.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))
    ).then(()=> self.clients.claim())
  );
});

// استراتيجية: جرب الشبكة الأول (عشان البيانات/التحديثات تفضل حديثة)،
// ولو الشبكة مش متاحة (أوفلاين) ارجع للكاش المحلي.
self.addEventListener('fetch', event=>{
  if(event.request.method !== 'GET') return;
  const isNavigation = event.request.mode === 'navigate';

  event.respondWith(
    fetch(event.request).then(response=>{
      // حدّث الكاش بأحدث نسخة كل ما النت يكون شغال
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache=> cache.put(event.request, copy)).catch(()=>{});
      return response;
    }).catch(()=>
      caches.match(event.request).then(cached=>{
        if(cached) return cached;
        // لو طلب فتح صفحة (navigation) ومفيش نسخة مخزنة بالظبط، رجّع index.html كبديل
        if(isNavigation) return caches.match('./index.html');
        // لو ملف فرعي (سكريبت/خط) مش مخزّن، سيبه يفشل بشكل طبيعي —
        // رجّع له index.html بالغلط ممكن يبوّظ تحميل الصفحة كلها (سكريبت هيتحمل كـ HTML)
        return new Response('', {status:504, statusText:'Offline and not cached'});
      })
    )
  );
});
