const CACHE = "ficha-treino-v4";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
const APP_PATHS = new Set(["/ficha-treino/", "/ficha-treino/index.html"]);
const TIMEOUT_MS = 3000;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fromNetworkWithTimeout(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
    fetch(request).then(r => { clearTimeout(timer); resolve(r); }, err => { clearTimeout(timer); reject(err); });
  });
}

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== self.location.origin && !isFont) return;

  // Página do app: rede primeiro com limite de 3 s; sem rede ou lenta, usa a cópia guardada.
  if (e.request.mode === "navigate") {
    const isApp = APP_PATHS.has(url.pathname) || url.pathname.endsWith("/index.html");
    e.respondWith(
      fromNetworkWithTimeout(e.request)
        .then(r => {
          if (r.ok && isApp) { const copy = r.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); }
          return r;
        })
        .catch(() => caches.match("./index.html").then(hit => hit || fetch(e.request)))
    );
    return;
  }

  // Ícones, manifest e fontes: cópia guardada primeiro.
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }))
  );
});
