// X03: the push part of the service worker (imported by the one vite-plugin-pwa generates). Shows the
// notice sent by the Edge Function `enviar-push` and, when tapped, opens (or focuses) the app on its screen.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Bicos', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Bicos', {
      body: data.body || '',
      tag: data.tag,
      icon: 'icons/icon-192.png',
      badge: 'icons/favicon-32.png',
      lang: 'pt-BR',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Routes are relative to where the app lives (VITE_BASE).
  const url = new URL((event.notification.data?.url || '/').replace(/^\//, ''), self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => c.url.startsWith(self.registration.scope));
      if (open) return open.navigate(url).then((c) => (c || open).focus());
      return self.clients.openWindow(url);
    })
  );
});

// The browser renewed the address: tell the app next time it opens (it saves it again on start).
self.addEventListener('pushsubscriptionchange', () => {});
