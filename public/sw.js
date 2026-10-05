/**
 * Service Worker do Sorria — shell estático apenas.
 * NÃO cacheia prontuário, financeiro, evolução clínica ou dados de pacientes.
 */
const CACHE = "sorria-shell-v1";
const PRECACHE = ["/", "/offline", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

function isSensitive(url) {
  const p = new URL(url).pathname;
  if (p.startsWith("/api/")) return true;
  if (p.startsWith("/app/pacientes")) return true;
  if (p.startsWith("/app/financeiro")) return true;
  if (p.startsWith("/app/agenda/atendimento")) return true;
  if (p.startsWith("/portal")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isSensitive(req.url)) return;

  // Navegação: network-first; offline → /offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => res)
        .catch(async () => {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match("/offline")) ||
            new Response("Sem conexão", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }),
    );
    return;
  }

  // Assets estáticos: cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.match(/\.(png|svg|ico|jpg|jpeg|webp|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            void caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
  }
});
