// キャッシュ名を変えると activate 時に旧キャッシュが削除される。
// キャッシュ戦略を変更したら必ずバージョンを上げること。
const VERSION = 'v5';
const STATIC_CACHE = `kakeibo-static-${VERSION}`; // /_next/static（ハッシュ付き・不変）
const PAGE_CACHE = `kakeibo-pages-${VERSION}`;     // ページの HTML（オフライン時の表示用）
const ASSET_CACHE = `kakeibo-assets-${VERSION}`;   // public/ のアイコン・manifest など
const CURRENT_CACHES = [STATIC_CACHE, PAGE_CACHE, ASSET_CACHE];

// キャッシュの件数の上限（#109）。古く入れたものから消す。
// 静的アセットはデプロイごとに新しいファイル名になるので、上限が無いと
// 古いデプロイのチャンクが溜まり続ける。1回のデプロイで読むチャンクは数十件なので、
// 数世代分を残せる件数にしている（オフラインで古い画面を開いても壊れにくいように）
const LIMITS = {
  [STATIC_CACHE]: 300,
  [PAGE_CACHE]: 10,
  [ASSET_CACHE]: 30,
};

const PRECACHE_PAGES = ['/', '/history'];
const PRECACHE_ASSETS = ['/manifest.json', '/favicon.png'];

// キャッシュしないリクエストの判定
// 自オリジンの GET のみをキャッシュする。Firebase との通信も拡張機能の
// リクエストも自動的に対象外になる（ドメイン名の文字列一致に頼らない）。
const shouldBypass = (request, url) => {
  if (request.method !== 'GET') return true;
  if (url.origin !== self.location.origin) return true;
  // Next の RSC（画面遷移・プリフェッチのデータ）はページごと・月ごとに変わるので
  // キャッシュしない。オフラインでは Next がページの再読み込みに切り替え、
  // そのときはページの HTML のキャッシュで表示できる
  if (request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')) return true;
  // 画像の最適化・開発用の通信・SW 自身はキャッシュしない
  if (url.pathname.startsWith('/_next/image') || url.pathname.startsWith('/_next/webpack-hmr')) return true;
  if (url.pathname === '/sw.js') return true;
  return false;
};

// キャッシュに保存してよいレスポンスか（自オリジンの正常応答のみ）
const isCacheable = (response) => response && response.ok && response.type === 'basic';

/** 件数の上限を超えた分を、古く入れたものから消す（cache.keys() は入れた順） */
const trimCache = async (name) => {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  const excess = keys.length - LIMITS[name];
  if (excess <= 0) return;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
};

/** キャッシュへ書き、上限を保つ。event.waitUntil に渡して SW が途中で止まらないようにする */
const putAndTrim = async (name, key, response) => {
  const cache = await caches.open(name);
  await cache.put(key, response);
  await trimCache(name);
};

// インストール: 最低限のシェルを事前キャッシュし、即座に待機を解除
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(PAGE_CACHE).then((cache) => cache.addAll(PRECACHE_PAGES)),
      caches.open(ASSET_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS)),
    ]).then(() => self.skipWaiting())
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
            .filter((name) => !CURRENT_CACHES.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// フェッチ戦略:
// - ページ（ドキュメント）: ネットワークファースト。
//   常に最新のアプリを表示し、オフライン時のみキャッシュにフォールバックする。
//   （キャッシュファーストにするとデプロイ後も古い画面が出続けるため不可）
//   ?month= などのクエリ違いを別々に溜めないよう、パスだけをキーにする
// - /_next/static: キャッシュファースト。ファイル名にハッシュが入っていて中身が
//   変わらないので、キャッシュにあればネットワークへ行かない（#109）
// - それ以外（public/ のアイコンなど）: キャッシュを返しつつ裏で更新する
self.addEventListener('fetch', (event) => {
  const { request } = event;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return; // URL として解釈できないものはキャッシュしない
  }
  if (shouldBypass(request, url)) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    const pageKey = url.pathname;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            event.waitUntil(putAndTrim(PAGE_CACHE, pageKey, response.clone()));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(pageKey, { cacheName: PAGE_CACHE })
            .then((cached) => cached || caches.match('/', { cacheName: PAGE_CACHE }))
            .then((cached) => cached || Response.error())
        )
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request, { cacheName: STATIC_CACHE }).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (isCacheable(response)) {
              event.waitUntil(putAndTrim(STATIC_CACHE, request, response.clone()));
            }
            return response;
          })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request, { cacheName: ASSET_CACHE }).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            event.waitUntil(putAndTrim(ASSET_CACHE, request, response.clone()));
          }
          return response;
        })
        .catch(() => cached || Response.error());
      if (cached) {
        // 裏での更新が終わるまで SW を止めない
        event.waitUntil(network.catch(() => undefined));
        return cached;
      }
      return network;
    })
  );
});
