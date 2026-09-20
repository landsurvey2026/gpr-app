/* GPR 관측기록 프로그램 - 오프라인 앱 셸 캐시 */
const CACHE_NAME = "gpr-app-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./lib/xlsx.full.min.js",
  "./lib/jszip.min.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  // 앱 껍데기(HTML 문서, 즉 index.html)는 "네트워크 우선"으로 바꾼다.
  // 예전에는 캐시를 먼저 보여주고 백그라운드에서만 최신본을 받아와서, GitHub에 새 파일을
  // 올려도 한 번 새로고침해서는 예전 화면이 그대로 보이고 한 번 더 새로고침해야 반영됐음.
  // 온라인이면 항상 최신 파일을 바로 받아오고(캐시도 갱신), 오프라인일 때만 마지막 캐시로 대체한다.
  const isDocument = e.request.mode === "navigate" || e.request.destination === "document";
  if (isDocument) {
    e.respondWith(
      fetch(e.request, { cache: "no-store" })
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 그 외 정적 자원(manifest/라이브러리/아이콘)은 자주 안 바뀌므로 기존처럼
  // 캐시를 먼저 보여주고 백그라운드에서 갱신(오프라인에서도 빠르게 동작).
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
