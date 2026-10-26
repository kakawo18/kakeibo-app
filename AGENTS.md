# AGENTS.md

家計簿（kakeibo）— 個人向け家計簿 PWA。コーディングエージェント向けの作業ガイド。
アプリの使い方は `docs/user-guide.md`、詳細な構成は `docs/architecture.md` を参照。

## 技術スタック

- **Next.js 16**（App Router, Turbopack）/ React 19 / TypeScript（strict）
- **Mantine 8**（UI・フォーム・通知・モーダル）— レイアウトとスタイルは基本 Mantine プロパティで組む
- **Recharts**（チャート）※ Mantine Charts ではない
- **Firebase**（Auth: メール/パスワードのみ、Firestore）。サーバー側は Claude 連携だけが Admin SDK（`firebase-admin`）を使う
- **mcp-handler 2.x**（Claude 連携の MCP サーバー。`docs/claude-connector/`）
- **framer-motion**（アニメーション・スワイプ）、**dayjs**（日付）

## セットアップ・コマンド

```bash
npm install                 # 依存インストール（postinstall で type-check が走る）
npm run dev                 # 開発サーバー（http://localhost:3000, Turbopack）
npm run build               # 本番ビルド
npm run lint                # ESLint
npm run type-check          # tsc --noEmit
npm test                    # Vitest（会計・集計の回帰テスト）
npm run test:emulator       # Firestore エミュレータで保存形式とルールを検証（Java が必要）
npm run test:e2e            # Playwright で画面の主要な流れを検証（エミュレータ + 本番ビルド。Java が必要）
```

- 実行には `.env.local`（Firebase 設定）が必要。`.env.example` をコピーして埋める（手順は `docs/setup.md`）。
- 未設定でもビルドは通る（`src/lib/firebase.ts` がプレースホルダーで初期化）が、認証・データ取得は動かない。
- ローカルの Firebase エミュレータを使う場合は `.env.local` に `NEXT_PUBLIC_FIREBASE_EMULATOR=1`（ポートは `firebase.json`）。

## 変更後に必ず通すチェック

コミット前に `npm run lint`・`npm run type-check`・`npm test` を通すこと（CI でも同じものと `npm run build` が走る: `.github/workflows/ci.yml`）。ランタイム挙動を変えた場合は `npm run dev` で実際に動作を確認する。

### テスト

- 対象は React・Firebase に依存しない純関数（`src/domain/` の集計・ルール・税計算、`src/data/csvUtils.ts`、`src/utils/` の日付・入力チェックなど）。画面は E2E テスト（下記）で主要な流れだけを確かめる。
- 代表的な会計ケースの期待値と根拠は `docs/testing.md` の表にまとめている。会計ルールを足したら表にも1行足す。
- テストは対象ファイルの隣に `*.test.ts` で置く（例: `src/domain/calculations.test.ts`）。
- 架空データは `src/test/fixtures.ts` の `testSettings`・`testRules`・`tx()` を使う。役割ごとのカテゴリを一通り用意してある。**本番の家計データをテストに入れない**。
- タイムゾーンは `vitest.config.ts` で `Asia/Tokyo` に固定している（月の判定がローカル時刻に依存するため）。
- 不具合を直すときは、先に再現するテストを書いてから直す。**既知の不具合の挙動を正しい仕様としてテストに固定しない**。
- Firestore への書き込み（保存形式・`deleteField`・ルール）が絡む変更は、`*.emulator.test.ts` にエミュレータのテストを書く。`npm run test:emulator` が Firebase CLI（`npx firebase-tools`）でエミュレータを起動し、`firestore.rules` を読み込んで実行する。Java 21 が必要。CI でも別ジョブで走る。
- **E2E テスト**は `e2e/*.spec.ts`（Playwright）。`npm run test:e2e` が Auth と Firestore のエミュレータを `firebase.e2e.json` のポート（9199 / 8180。開発用の `firebase.json` とは別）で起動し、エミュレータにつなぐ設定で本番ビルドしたアプリを 3100 番で動かして、デスクトップとモバイルの幅で操作する。本番ビルドは `.next` に出るので、手元の `npm run build` の成果物は上書きされる。テストごとに新しいアカウントを作り、本番の Firebase への通信は `e2e/fixtures.ts` で遮断している。対象は登録・ログイン・取引の追加/編集/削除などの主要な流れだけで、金額の細かい正しさは単体テストで確かめる。CI（`.github/workflows/e2e.yml`）では、PR に `e2e` ラベルを付けたときと、`main` へのマージ後に走る。
- Firestore の操作と変換は `src/data/` にまとめる。読み書きは `*Repository.ts`（`transactionRepository` / `recurringTransactionRepository` / `settingsRepository`。`db` を引数で受け取る）、保存形式の変換は `*Serializer.ts`。Context は状態の配布と購読の開始・解除だけを持ち、`collection` / `doc` / `onSnapshot` などを直接呼ばない。**作成と部分更新は別の関数**にし、更新では「undefined = 変更しない / 空文字 = 項目を消す（`deleteField`）」とする。
- Repository の契約（購読・作成・更新・削除・旧データ・ルール）は `src/data/repositories.emulator.test.ts` で検証している。関数を足したらここにもテストを足す。

## コード規約

- **画面の置き場所**: 機能ごとの画面は `src/features/<機能>/`（auth / dashboard / transactions / recurring / review / settings / import-export）。機能の外からは `@/features/<機能>`（index.ts）だけを import し、中のファイルを直接参照しない（機能の中は相対パス）。外から使うものを増やしたら index.ts に足す。`src/components/` は特定の機能に依存しない共通 UI。`src/app/` はルーティング・レイアウト・Provider の配置と Route Handler の入り口だけ。サーバーでだけ動くコード（Claude 連携の MCP サーバー・認可サーバー・Admin SDK での読み出し）は `src/server/` に置き、各ファイルの先頭で `import 'server-only'` する。`src/server` と `firebase-admin` は画面・Context・データアクセス・domain から import しない（ESLint で検査している）。
- **依存の向き**: `app` → `features` → `components` / `contexts` → `data` → `domain` → `utils` / `types`。会計の計算（集計・役割・カード還元・税の推定・カテゴリの改名）は `src/domain/` に置き、React・Next・Firebase・Mantine と画面・Context・データアクセスを import しない（ESLint の `no-restricted-imports` で検査している）。表示用の色付けなどは画面側で行う。
- **関数コンポーネント + フック**のみ。クライアントコンポーネントは先頭に `'use client'`。
- **状態管理**: グローバルは 4 つの Context（`AuthContext` / `SettingsContext` / `TransactionsContext` / `RecurringTransactionsContext`、`src/app/layout.tsx` でラップ）。Firestore の購読（`onSnapshot`）はコレクションごとに Context の1か所だけに置き、画面やモーダルでは購読しない。取引は起動時に直近13か月だけを読む（#125）。それより前の月・年や全期間を使う画面は `useHistoryFor(needed)`（`src/components/ui/HistoryGate.tsx`）で過去の分を読み、そろうまで金額を出さない（未取得を0円に見せない）。削除の可否など欠けていると困る判断は `historyComplete` を見る。表示中の年月は **URL クエリ `?month=YYYY-MM`** で持ち、`useSearchParams` で読む（専用の state は作らない）。
- **集計はカテゴリ名ではなく「役割」（`CategoryRole`）で判定する**。投資・立替金・カード引き落とし等の除外判定は `src/domain/transactionRules.ts` の `createTransactionRules` が生成する関数群を使う。カテゴリ名で `if` 分岐しないこと。取引をカテゴリで分類・表示するときは `t.category` ではなく `rules.categoryName(t)` / `rules.chartKey(t)` を使う（改名前の名前を今の名前に読み替える。#97）。
- **色**: セマンティック色（収入=`--income` / 支出=`--expense` / アクセント=`--accent`）とデザイントークンは `src/app/globals.css` の CSS 変数。カテゴリ/カードの色はユーザー設定（`getColor`）とパレット `src/config/colorPalette.ts` から解決する。コンポーネントに 16 進数の色を直書きしない。
- **デザインシステム "Quiet Ledger"**: フラットな面 + ヘアライン境界（グラデーション/グラスモーフィズムは使わない）。カードは `.ledger-card`。
- **レスポンシブ**: モバイル判定は `useMediaQuery('(max-width: 768px)')` の `isMobile`。この 768px ブレークポイントが全体で共通。

## 重要な注意点（ハマりどころ）

- **Turbopack は `globals.css` の変更を反映しないことがある**（再起動でも直らない）。CSS 変更が computed style に出ないときは `.next` を削除して再起動する。
- **z-index の階層**: Mantine モーダル = 200。`.app-header` は 100、モバイル FAB（Affix）は 150。**200 以上にしない**（フルスクリーンモーダルの閉じるボタンを覆い、PWA でユーザーが戻れなくなる）。
- **カード支払いの会計ロジック**: クレジットカードの支出は**購入月に計上する**。実際の口座残高や引き落とし月は扱わない（アプリが計算するのは「収支 = 選択月の収入−支出」のみ）。`transactionType`（`normal` / `card_payment`）と `affectsExpense` フラグで表現し、`rules.deriveTransactionFlags` が導出する。詳細は `docs/機能仕様書.md` の「クレジットカード払いの会計モデル」。
- **モバイル入力**: iOS のズーム防止でフォントは 16px、タップ領域は 48px を確保する（`globals.css` の PWA 用ブロック）。
- **Vercel の Node.js は ES モジュールの `require()` に未対応の版**（設定は 22.x）。サーバーで `firebase-admin/auth`（と全部を読み込む `firebase-admin`）を使うと、依存の `jwks-rsa` が `jose` を読み込めず、そのルートが本番だけ 500 になる（ESLint で禁止している）。手元の Node.js では再現しないので、サーバー側の依存を足したら `engines` を見て、怪しければ standalone ビルドを古い Node.js で動かして確かめる。経緯は `docs/claude-connector/手順書.md` 10.1。
- **Firestore のエミュレータは複合インデックスを要求しない**。新しい条件や並び順のクエリはテストで通っても本番で `FAILED_PRECONDITION` になる。クエリを足したら `firestore.indexes.json` に足し、本番に作ってからデプロイする（手順書 10.2）。

## セキュリティ

- `.env.local` は**コミットしない**（`.gitignore` 済み）。クライアントに出してよい値は `NEXT_PUBLIC_*` のみ。`next.config.ts` の `env` は使わない（`NEXT_PUBLIC_` 無しでもバンドルに埋め込まれるため、秘密情報の混入に気づけない）。
- **画面からの Firestore のアクセス制御は `firestore.rules` だけで担保している**（クライアント直結で、画面用のサーバー側の API 層は無い）。
- **例外は Claude 連携のサーバー（`src/server/`）で、Admin SDK は `firestore.rules` を通らない。** 利用者のデータを読むのは `src/server/kakeiboReader.ts`、書くのは `src/server/kakeiboWriter.ts` の関数だけにし、必ず uid（トークンの検証結果から得たもの）で絞る。書き込みはルールを通らないので、ルールと同じ形・上限で書く（`docs/claude-connector/書き込み仕様書.md` 6章）。uid をツールの入力から受け取らない。認可コードとリフレッシュトークン（`oauthAuthorizationCodes` / `oauthRefreshTokens`）はクライアントから一切触れないようルールで拒否している。詳細は `docs/claude-connector/仕様書.md` の 7.2 と 8章。
- 画面のデータの置き場所: 取引はトップレベル `transactions`（`userId` フィールドで所有者判定）、設定と定期取引は `users/{uid}/` 配下。**コレクション構成を変えたら必ず `firestore.rules` も更新し、`firebase deploy --only firestore:rules` で反映する。**
- 取引の更新・削除はクライアント側で所有者チェックをしていない。所有者の検証はルール側の責務。
- 本番デプロイ先ドメインは Firebase Console の Authentication → Authorized domains に追加が必要。
- セキュリティヘッダーは `next.config.ts` の `securityHeaders` に集約。CSP は現在 **Report-Only**。接続先（Firebase 等）を増やしたら `connect-src` を更新する。
- 家計データを `console` に出さない。本番ビルドでは `console.error` 以外は除去される（`compiler.removeConsole`）が、`error` に取引の中身を渡さないこと。

## バージョン管理

ユーザーに見える変更を入れたら**毎回バージョンを更新する**。バージョンは `package.json` の `version` が唯一の情報源で、画面下部の `VersionDisplay`（`v5.1.0 / © Gorillaburg Inc.`）がそれを表示する。どのデプロイが入っているかの判別に使うため、更新漏れは避ける。

- 付け方は Semantic Versioning。破壊的変更・全面刷新 = major / 機能追加 = minor / バグ修正・軽微な調整 = patch。
- 同じ PR の中で `docs/CHANGELOG.md` の**先頭**に `## [x.y.z] - YYYY-MM-DD` の節を追加し、`### 追加` / `### 改善` / `### 修正` / `### 技術的変更` に変更点を書く。
- バージョン更新は独立した PR に切り出さず、変更本体と同じ PR に含める。
- リファクタのみ・ドキュメントのみなど、ユーザーの見える挙動が変わらない変更はバージョンを上げなくてよい。

## コミット / PR

- コミットは日本語。Conventional Commits 形式のプレフィックス（`feat:` / `fix:` / `refactor:` / `chore:` / `style:`）を付けるのが基本。
- `main` へ直接コミットしない。フィーチャーブランチで作業し PR を作る。
- push で Vercel が自動デプロイ（本番 = `main`、PR = プレビュー）。

### ブランチ運用（GitHub Flow）

- `main` が常に本番。`develop` のような長く続く統合ブランチは作らず、PR を `main` にマージした時点でリリースになる。
- **1 つの PR に 1 つのブランチ。** 作業のたびに最新の `main` から切り、マージ済みのブランチを次の作業に使い回さない。名前は `<type>/<短い説明>`（例: `fix/123-duplicate-items`、`ci/add-build-job`）を基本とする。
- マージの前に、CI（`.github/workflows/ci.yml`）が通っていることを確かめる。登録・ログイン・取引の入力など画面の流れに関わる変更では、PR に `e2e` ラベルを付けて E2E テストも通す（付けるかどうかは下の「`e2e` ラベルを付ける PR」で決める。マージ後の `main` では毎回走るが、その時点で本番にはもう出ている）。画面や挙動が変わる変更は、PR ごとに作られる Vercel のプレビュー URL で実際に操作してから出す。これがリリース前の確認で、ステージング環境は別に持たない。プレビューも本番と同じ Firebase につながるので、確かめるときはテスト用のアカウントを使い、本番の家計データを書き換えない。
- マージはマージコミットで行う（squash しない）。コミットの本文に書いた経緯を残すため。
- マージしたらブランチを消す（GitHub の Settings → General の「Automatically delete head branches」で自動にできる）。
- 本番で不具合が出たら、まず Vercel で前のデプロイに戻し（`docs/deployment.md` の「更新とロールバック」）、直しはいつもどおり新しいブランチの PR で入れる。

### `e2e` ラベルを付ける PR

PR を作るエージェントは、利用者に言われなくても**変更したファイルからラベルの要否を判断し**、必要なら作成時に付ける（`gh pr create --label e2e`、作成後なら `gh pr edit <番号> --add-label e2e`）。PR の本文の「確認方法」に、付けた／付けなかった理由を1行書く。後から足したコミットで条件に当てはまるようになったら、その時点で付ける。

E2E が確かめているのは、登録・ログイン・ログアウト、取引の追加・編集・削除、ダッシュボードへの反映（一覧は `docs/testing.md`）。これを壊しうる変更なら付ける。

**付ける**（どれか1つでも当てはまれば）:

- `src/features/auth/`・`src/features/transactions/`・`src/features/dashboard/` の変更
- 画面全体にかかる部分: `src/app/` の `layout.tsx`・`(tabs)/` の画面、`src/contexts/`、`src/components/`（フォーム・ナビ・共通 UI）、`src/hooks/`、`src/app/globals.css`
- 保存と読み込み: `src/data/`、`src/lib/firebase.ts`、`firestore.rules`、`firestore.indexes.json`
- 取引の保存内容が変わる `src/domain/` の変更（`deriveTransactionFlags` など、保存するフラグを決める関数）
- 実行環境: `next.config.ts`（CSP・ヘッダー）、`package.json` / `package-lock.json` の依存の更新（Next.js・React・Mantine・Firebase・framer-motion など画面で使うもの。Dependabot の PR も含む）
- E2E そのもの: `e2e/`、`playwright.config.ts`、`firebase.e2e.json`、`.github/workflows/e2e.yml`

**付けない**:

- ドキュメントだけ（`docs/`・`*.md`）、コメントだけの変更
- 集計・表示の計算だけの `src/domain/` の変更と、単体テスト・エミュレータのテストだけの変更
- Claude 連携のサーバー側（`src/server/`・`src/app/api/`・`src/app/oauth/`）だけの変更（E2E の対象外）
- 他の機能（`recurring` / `review` / `settings` / `import-export` / `claude-connect`）の中だけで閉じた変更
- E2E 以外の CI 設定（`.github/workflows/ci.yml` など）、devDependencies だけの更新

迷ったら付ける（かかるのは CI の時間だけで、付け忘れて壊すと本番に出てから気づくことになる）。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
