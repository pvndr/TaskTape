import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

// Clean up outdated caches
cleanupOutdatedCaches();

// Precache app shell, assets and fonts locally bundled
precacheAndRoute(self.__WB_MANIFEST || []);

// Offline navigation fallback: serve precached index.html for app shell starts
try {
  const handler = createHandlerBoundToURL('/index.html');
  const navigationRoute = new NavigationRoute(handler, {
    denylist: [/^\/_/, /\/[^/?]+\.[^/]+$/]
  });
  registerRoute(navigationRoute);
} catch (err) {
  console.warn('NavigationRoute setup fallback warning:', err);
}

// Auto update
self.skipWaiting();
clientsClaim();

// Push notification listener
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const { title = 'TaskTape', body = '', url = '/' } = payload;

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'oldest-nudge', // replaces any previous oldest-nudge notification
        vibrate: [], // no vibration pattern
        data: { url }
      })
    );
  } catch (err) {
    console.error('Failed to parse push notification payload:', err);
  }
});

// Notification click listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing app window if already open
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window open, open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
