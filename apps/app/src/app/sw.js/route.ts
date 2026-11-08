import { connection } from "next/server";
import { storageMode } from "@/server/config";

/**
 * Service worker, served from a route so it needs no public/ folder in the image.
 *
 * Server mode: it stores nothing (pages carry the plan and are always live);
 * all it adds is a friendly page when the server can't be reached.
 *
 * Local mode: pages hold no data (the plan lives in IndexedDB), so it keeps
 * a copy of every page and build asset it has loaded. The app then opens
 * offline, on every page visited before.
 */
const OFFLINE_PAGE = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0c0c0e">
<title>Keine Verbindung</title>
<style>
  body { margin: 0; min-height: 100dvh; display: grid; place-content: center; gap: 12px; padding: 24px; box-sizing: border-box;
    background: #0c0c0e; color: #f4f4f5; font: 16px/1.5 system-ui, sans-serif; text-align: center; }
  h1 { margin: 0; font-size: 22px; }
  p { margin: 0; color: #a1a1aa; }
  button { justify-self: center; margin-top: 8px; padding: 10px 18px; border: 0; border-radius: 8px; background: #ff6b35; color: #fff; font: inherit; font-weight: 600; }
</style>
</head>
<body>
  <h1>Keine Verbindung</h1>
  <p>Der Server ist gerade nicht erreichbar.</p>
  <button onclick="location.reload()">Erneut versuchen</button>
  <script>addEventListener("online", () => location.reload());</script>
</body>
</html>`;

const SERVER_WORKER = `const OFFLINE_PAGE = ${JSON.stringify(OFFLINE_PAGE)};

self.addEventListener("install", () => self.skipWaiting());
// Pages carry the plan in server mode: drop anything a local-mode worker cached before.
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
`;

const LOCAL_WORKER = `const OFFLINE_PAGE = ${JSON.stringify(OFFLINE_PAGE)};
const CACHE = "sums-local-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request, { ignoreSearch: true });
    return hit ?? new Response(OFFLINE_PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") return event.respondWith(networkFirst(req));
  // Build assets have content hashes in their names: a cached copy never goes stale.
  if (url.pathname.startsWith("/_next/static/")) return event.respondWith(cacheFirst(req));
  if (/^\\/(icon\\.svg|apple-icon|app-icon\\/|manifest\\.webmanifest)/.test(url.pathname)) return event.respondWith(networkFirst(req));
});
`;

export async function GET() {
  await connection();
  return new Response(storageMode() === "local" ? LOCAL_WORKER : SERVER_WORKER, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
