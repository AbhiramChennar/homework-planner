// Service worker: caches the app's own files so it opens fast and still loads
// (the demo, and the page shell) without a connection.
//
// Strategy:
// * Pages: network first, so you always get the newest version when online;
//   fall back to the cached copy when offline.
// * /_next/static files: cache first. Their names contain a hash of their
//   contents, so a cached copy is never out of date.
// * Anything from another site (Supabase, fonts): not touched. Your data always
//   comes live from the database.
//
// Bump VERSION to throw away old caches after a big change.
const VERSION = "v1";
const CACHE = `homework-planner-${VERSION}`;
const SCOPE = new URL(self.registration.scope).pathname; // "/" or "/homework-planner/"

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([SCOPE, `${SCOPE}login/`])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.includes("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request)
          .then((cached) => cached || (request.mode === "navigate" ? caches.match(SCOPE) : undefined))
          .then((cached) => cached || Response.error()),
      ),
  );
});
