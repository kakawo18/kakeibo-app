// キャッシュ名を変えると activate 時に旧キャッシュが削除される。
// キャッシュ戦略を変更したら必ずバージョンを上げること。
const CACHE_NAME = 'kakeibo-app-v2';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.png',
];

// キャッシュしないリクエストの判定（Firebase / 非GET / 拡張機能など）
const shouldBypass = (request) => {
  if (request.method !== 'GET') return true;
  const url = request.url;
  return (
    !url.startsWith('http') ||
    url.includes('firebaseapp.com') ||
    url.includes('googleapis.com') ||
    url.includes('firestore') ||
    url.includes('firebase')
  );
};

// インストール: 最低限のシェルを事前キャッシュし、即座に待機を解除
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// 有効化: 旧バージョンのキャッシュを削除し、開いているページを即座に制御下に置く
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// フェッチ戦略:
// - ドキュメント（ページ遷移）: ネットワークファースト。
//   常に最新のアプリを表示し、オフライン時のみキャッシュにフォールバックする。
//   （キャッシュファーストにするとデプロイ後も古い画面が出続けるため不可）
// - 静的アセット: キャッシュファースト + バックグラウンド更新（stale-while-revalidate）
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (shouldBypass(request)) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
