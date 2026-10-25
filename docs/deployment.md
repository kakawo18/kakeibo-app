# デプロイ

Vercel + Firebase 構成。`main` への push で Vercel が本番自動デプロイ、PR ごとにプレビュー環境が作られる。

## 初回セットアップ

1. GitHub にリポジトリを用意して push する（個人用途なので Private 推奨）。
2. [Vercel](https://vercel.com) で「Add New → Project」からリポジトリを Import。Framework は Next.js が自動検出される。
3. **環境変数を設定**（下記）。
4. Deploy。

## Node.js のバージョン

`package.json` の `engines.node`（`22.x`）で Vercel の関数の Node.js を固定している。Vercel はプロジェクト設定の Node.js Version よりこちらを優先する。Claude 連携が使う `firebase-admin` 14 は Node.js 22 以上を要する。CI（`.github/workflows/ci.yml`）も Node.js 22 で動かしている。

なお Vercel の Node.js 22 は ES モジュールの `require()`（Node.js 22.12 から既定で有効）に対応していない版で、`firebase-admin/auth` は読み込めない（依存する `jwks-rsa` が `jose` を `require()` して `ERR_REQUIRE_ESM` になる）。サーバーのコードは `firebase-admin/app` と `firebase-admin/firestore` だけを使い、Firebase の ID トークンは `jose` で検証している（v6.7.2。ESLint で `firebase-admin/auth` を禁止している）。

## Vercel の環境変数

`.env.local` と同じ 6 つを Vercel のプロジェクト設定 → Environment Variables に登録する:

| キー |
|------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` |

### Claude 連携を使う場合

次の6つを **Production 環境だけ** に登録する（Preview には入れない。プレビューの URL ごとに本番データへの入り口が増えるため）。作り方は `docs/claude-connector/手順書.md` の2章。どれも `NEXT_PUBLIC_` を付けない（ブラウザ向けのバンドルに入れない）。

| キー | 中身 |
|------|------|
| `MCP_ENABLED` | `1` で有効。消すか `1` 以外にして再デプロイすると、Claude 連携のエンドポイントがすべて 404 になる |
| `MCP_PUBLIC_ORIGIN` | 本番の URL（末尾の `/` なし）。Claude に登録する URL とトークンの宛先になるので、変えると全員がつなぎ直す |
| `MCP_OAUTH_CLIENT_ID` | Claude のコネクタに入力する Client ID |
| `MCP_ALLOWED_UIDS` | 使ってよい Firebase の uid（カンマ区切り）。外せば即座に使えなくなる |
| `MCP_TOKEN_SECRET` | アクセストークンの署名鍵（32バイト以上の乱数）。替えると発行済みのアクセストークンが無効になる |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Admin SDK 用サービスアカウントの JSON を base64 にしたもの |

期限の切れた認可コードとリフレッシュトークンは、トークンを発行するたびにアプリが消す（Firestore の TTL は無料プランでは使えないため。v6.8.0）。あわせて `firestore.indexes.json` の複合インデックスを作っておく（下記）。

## Firestore のインデックス

使っている複合インデックスは `firestore.indexes.json` で管理する（`transactions` の `userId` + `date` の降順と昇順）。降順はアプリの画面、昇順は Claude 連携の概要（最も古い取引を引く）が使う。無ければ Firebase Console →「Firestore Database」→「インデックス」で作るか、`firebase deploy --only firestore:indexes` で反映する。エミュレータはインデックスを要求しないので、テストでは気づけない。

## Firebase 側の必須設定

- **Authorized domains**: Firebase Console → Authentication → Settings → Authorized domains に、Vercel が発行した本番ドメイン（例: `kakeibo-app-xxxx.vercel.app`）とカスタムドメインを追加する。追加しないとデプロイ先でログインできない。確認メールのリンクの戻り先（`/auth/email-link`）もこのドメインなので、無いとリンクを送れない（`auth/unauthorized-continue-uri`）。
- **メールリンク**: Authentication → Sign-in method →「メール/パスワード」を開き、「メールリンク（パスワードなしでログイン）」を有効にする。新規登録とパスワードの再設定はメールのリンクで行う（v6.9.0 から）。無効だと「確認メールを送る」が失敗する（`auth/operation-not-allowed`）。
- **メール列挙保護（推奨）**: Authentication → Settings →「ユーザー アクション」の「メール列挙保護」を有効にする。新しいプロジェクトでは既定で有効。
- **Firestore セキュリティルール**: ルールはリポジトリの `firestore.rules` で管理する。**このファイルを編集したら必ず反映すること**（反映しないと本番のルールは古いままになる）。

```bash
firebase deploy --only firestore:rules
```

  Firebase CLI を使わない場合は、`firestore.rules` の中身を Firebase Console → Firestore Database → ルール に貼り付けて公開する。

  取引データはトップレベルの `transactions` コレクションに `userId` フィールド付きで保存され、設定と定期取引は `users/{uid}/` 配下にある。**`users/{uid}/**` だけを許可するルールでは取引データが保護されない（あるいはアプリが動かない）**ので、必ず `firestore.rules` の内容と一致させる。
- **App Check（任意・推奨）**: Firebase Console → App Check で reCAPTCHA v3 を登録し、サイトキーを Vercel の環境変数 `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` に設定する。まず「未強制（監視のみ）」で様子を見てから強制に切り替える。

## デプロイ中のコミットSHAの表示

画面下部のバージョン表記の隣に、いま配信されているビルドのコミットSHA（先頭7桁）が出る。
「main にマージしたのに本番に反映されていない」ときの切り分けに使う。表示されている
SHA が GitHub の main の先頭と一致していなければ、本番はまだ古いデプロイのままである。

これは Vercel のシステム環境変数 `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` を読んでいる。
**SHA が表示されない場合**は、Vercel のプロジェクト設定 → Environment Variables の
「Automatically expose System Environment Variables」を有効にして再デプロイする。
ローカルの `npm run dev` では未定義になるため表示されない（正常）。

## 更新とロールバック

- **更新**: `main` に push すれば Vercel が自動でビルド・デプロイする。
- **ロールバック**: Vercel ダッシュボード → Deployments → 正常だったデプロイを選び「Promote to Production」。

## デプロイ後チェック

- ブラウザ / スマホでアクセスできる
- ログインできる（Authorized domains 設定済み）
- 取引の追加・編集・削除、チャート表示、CSV 入出力、月次ナビゲーションが動く
- データが Firestore に保存される

## トラブルシューティング

- **ビルドエラー**: ローカルで `npm run build` を通してから push する。
- **ログイン/データ取得できない**: Vercel の環境変数と Firebase の Authorized domains を再確認。取引の読み書きだけ失敗する場合は Firestore のルールが `firestore.rules` と一致しているかを確認。
- **白画面**: ブラウザ devtools のコンソールでエラー確認（多くは環境変数未設定）。
- **main にマージしたのに本番に反映されない**: まず画面下部のコミットSHAを GitHub の main の先頭と見比べる。
  1. **SHA が古い** → Vercel の Deployments を開く。ビルドが失敗していれば Building/Error の表示があるのでログを見る。成功しているのに本番に出ていない場合は該当デプロイを「Promote to Production」する。
  2. **SHA は一致しているのに見た目が古い** → ブラウザのキャッシュ。スーパーリロード（Windows: Ctrl+Shift+R / Mac: Cmd+Shift+R）。PWA としてインストールしている場合は Service Worker が残るため、devtools → Application → Service Workers → Unregister してから再読み込みする。
