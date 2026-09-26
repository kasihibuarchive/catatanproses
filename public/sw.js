/* 地蔵日誌 — offline fallback service worker.
   Intercepts document navigations only: network first, then a washi-styled
   fallback page when the app cannot be reached. API calls and assets stay
   network-only so data is never served stale (dev/HMR safe). */

const CACHE = "jizo-offline-v1";
const OFFLINE_KEY = "/__jizo-offline";

const OFFLINE_HTML = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Offline — 地蔵日誌</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #f6f2e7; color: #3b342b;
    font-family: "Zen Kaku Gothic New", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
    padding: 24px; text-align: center;
  }
  .card { max-width: 340px; }
  .seal {
    width: 56px; height: 56px; margin: 0 auto 20px; border-radius: 6px;
    background: #b8492f; color: #f7f2e6; display: flex; flex-direction: column;
    align-items: center; justify-content: center; line-height: 1.15;
    font-family: "Zen Old Mincho", "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
    font-size: 17px; transform: rotate(-3deg);
    box-shadow: inset 0 0 0 2px rgba(247, 242, 230, 0.28);
  }
  .kanji {
    letter-spacing: 0.5em; font-size: 13px; color: #b8492f;
    font-family: "Zen Old Mincho", "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
  }
  h1 {
    font-family: "Zen Old Mincho", "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
    font-size: 20px; margin: 10px 0 0; font-weight: 600;
  }
  .rule { height: 3px; background: #b8492f; width: 48px; margin: 18px auto; position: relative; }
  .rule::after {
    content: ""; position: absolute; left: 0; right: 0; top: 5px; height: 1px;
    background: #b8492f; opacity: 0.55;
  }
  p { font-size: 13px; line-height: 1.7; color: #7a7263; margin: 0 0 20px; }
  a { color: #3b342b; font-size: 13px; text-decoration: underline; text-underline-offset: 3px; }
</style>
</head>
<body>
  <main class="card">
    <div class="seal" aria-hidden="true"><span>地</span><span>蔵</span></div>
    <p class="kanji" aria-hidden="true">休息中</p>
    <h1>Kamu sedang offline</h1>
    <div class="rule" aria-hidden="true"></div>
    <p>Catatan latihan tidak bisa dimuat sekarang.<br />Periksa koneksi, lalu muat ulang halaman.</p>
    <a href="/">muat ulang</a>
  </main>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.put(
        OFFLINE_KEY,
        new Response(OFFLINE_HTML, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE);
        const offline = await cache.match(OFFLINE_KEY);
        return (
          offline ??
          new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }
    })()
  );
});
