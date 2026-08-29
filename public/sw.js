// キャッシュ名を変えると activate 時に旧キャッシュが削除される。
// キャッシュ戦略を変更したら必ずバージョンを上げること。
const CACHE_NAME = 'kakeibo-app-v4';
const PRECACHE_URLS = [
  '/',
  '/history',
  '/manifest.json',
  '/favicon.png',
];

// キャッシュしないリクエストの判定
// 自オリジンの GET のみをキャッシュする。Firebase との通信も拡張機能の
// リクエストも自動的に対象外になる（ドメイン名の文字列一致に頼らない）。
const shouldBypass = (request) => {
  if (request.method !== 'GET') return true;
  try {
    return new URL(request.url).origin !== self.location.origin;
  } catch {
    return true; // URL として解釈できないものはキャッシュしない
  }
};

// キャッシュに保存してよいレスポンスか（自オリジンの正常応答のみ）
const isCacheable = (response) => response && response.ok && response.type === 'basic';

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
          if (isCacheable(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
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
          if (isCacheable(response)) {
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
