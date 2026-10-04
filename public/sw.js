const OFFLINE_CACHE = "elpestro-offline-v1";
const OFFLINE_PAGE = "/offline.html";
const STAFF_PREFIXES = [
  "/admin",
  "/kitchen",
  "/counter",
  "/delivery",
  "/developer",
  "/staff-attendance",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_PAGE, { cache: "reload" })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("elpestro-offline-") && key !== OFFLINE_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (
    STAFF_PREFIXES.some(
      (prefix) =>
        requestUrl.pathname === prefix ||
        requestUrl.pathname.startsWith(prefix + "/")
    )
  ) {
    return;
  }

  event.respondWith(
    fetch(request).catch(async () => {
      const offlinePage = await caches.match(OFFLINE_PAGE);
      if (offlinePage) return offlinePage;
      return new Response(
        "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><title>EL PRESTO is offline</title><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><body style=\"margin:0;background:#160e0a;color:#fff;font:16px system-ui;display:grid;min-height:100vh;place-items:center;text-align:center\"><main><h1>You're offline</h1><p>Reconnect to continue ordering.</p></main></body></html>",
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
      );
    })
  );
});
