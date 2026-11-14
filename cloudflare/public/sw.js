// 2-6 알림장 서비스 워커: 푸시 알림 표시/클릭 처리만 담당 (오프라인 캐시 없음)
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function (e) {
  var m = {};
  try { m = e.data ? e.data.json() : {}; } catch (err) { m = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.title || '2학년 6반 알림장', {
    body: m.body || '', tag: m.tag || 'class26', icon: '/icon.png', badge: '/icon.png', lang: 'ko', data: { url: m.url || '/' }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) { if (list[i].navigate) list[i].navigate(url); return list[i].focus(); } }
    return self.clients.openWindow(url);
  }));
});
