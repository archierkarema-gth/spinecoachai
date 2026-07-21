/**
 * SpineCoach AI service worker — runtime caching so the app works fully
 * offline after the owner has opened each page once while online.
 *
 * Strategy (deliberately NOT a build-time precache list): this repo is
 * pinned to a Next.js version with unfamiliar internals (see AGENTS.md), so
 * hardcoding `_next/static/...` asset paths would be fragile across
 * rebuilds. Instead:
 *   - Navigations (HTML documents): network-first, falling back to the
 *     cached copy of that exact route, then to the cached "/" shell.
 *   - Everything else same-origin GET (JS/CSS bundles, icons, manifest):
 *     cache-first, filling the cache on first successful fetch.
 * All app data lives in IndexedDB (never touched here), so this only needs
 * to keep the app shell reachable offline.
 */

const CACHE_NAME = "spinecoach-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase/cross-origin calls

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match(request)) ||
            (await cache.match("/")) ||
            new Response(
              "<!doctype html><title>Offline</title><body style='font-family:sans-serif;padding:2rem;background:#121814;color:#E8EFE9'>Offline dan halaman ini belum pernah dibuka. Buka SpineCoach sekali saat online dulu.</body>",
              { headers: { "Content-Type": "text/html" } }
            )
          );
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    })()
  );
});
