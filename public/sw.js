// Service Worker — Lapidare
// Gerencia push notifications do check-in semanal

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Lapidare', {
      body: data.body ?? 'Você tem um check-in pendente!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'checkin-semanal',
      renotify: true,
      data: { url: '/paciente/checkin' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/paciente/checkin';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const match = wins.find(w => w.url.includes('/paciente'));
      if (match) {
        match.focus();
        match.navigate(targetUrl);
      } else {
        clients.openWindow(targetUrl);
      }
    })
  );
});
