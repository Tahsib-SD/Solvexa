// Solvexa - service worker "reset".
// Removes itself and clears every cache it ever created, so nothing stale can
// be served. The site works exactly like a normal website. (Offline/install
// support can be added back later, once everything is stable.)
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((c) => c.navigate(c.url));
    })()
  );
});
