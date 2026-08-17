# AGENTS.md

家計簿（kakeibo）— 個人向け家計簿 PWA。コーディングエージェント向けの作業ガイド。
アプリの使い方は `docs/user-guide.md`、詳細な構成は `docs/architecture.md` を参照。

## 技術スタック

- **Next.js 16**（App Router, Turbopack）/ React 19 / TypeScript（strict）
- **Mantine 8**（UI・フォーム・通知・モーダル）— レイアウトとスタイルは基本 Mantine プロパティで組む
- **Recharts**（チャート）※ Mantine Charts ではない
- **Firebase**（Auth: メール/パスワードのみ、Firestore）
- **framer-motion**（アニメーション・スワイプ）、**dayjs**（日付）

## セットアップ・コマンド

```bash
npm install                 # 依存インストール（postinstall で type-check が走る）
npm run dev                 # 開発サーバー（http://localhost:3000, Turbopack）
npm run build               # 本番ビルド
npm run lint                # ESLint
npm run type-check          # tsc --noEmit
```

- 実行には `.env.local`（Firebase 設定）が必要。`.env.example` をコピーして埋める（手順は `docs/setup.md`）。
- 未設定でもビルドは通る（`src/lib/firebase.ts` がプレースホルダーで初期化）が、認証・データ取得は動かない。
- ローカルの Firebase エミュレータを使う場合は `.env.local` に `NEXT_PUBLIC_FIREBASE_EMULATOR=1`（ポートは `firebase.json`）。

## 変更後に必ず通すチェック

コミット前に `npm run lint` と `npm run type-check` の両方を通すこと。ランタイム挙動を変えた場合は `npm run dev` で実際に動作を確認する（テストスイートは無い）。

## コード規約

- **関数コンポーネント + フック**のみ。クライアントコンポーネントは先頭に `'use client'`。
- **状態管理**: グローバルは 3 つの Context（`AuthContext` / `SettingsContext` / `TransactionsContext`、`src/app/layout.tsx` でラップ）。表示中の年月は **URL クエリ `?month=YYYY-MM`** で持ち、`useSearchParams` で読む（専用の state は作らない）。
- **集計はカテゴリ名ではなく「役割」（`CategoryRole`）で判定する**。投資・立替金・カード引き落とし等の除外判定は `src/utils/transactionRules.ts` の `createTransactionRules` が生成する関数群を使う。カテゴリ名で `if` 分岐しないこと。
- **色**: セマンティック色（収入=`--income` / 支出=`--expense` / アクセント=`--accent`）とデザイントークンは `src/app/globals.css` の CSS 変数。カテゴリ/カードの色はユーザー設定（`getColor`）とパレット `src/config/colorPalette.ts` から解決する。コンポーネントに 16 進数の色を直書きしない。
- **デザインシステム "Quiet Ledger"**: フラットな面 + ヘアライン境界（グラデーション/グラスモーフィズムは使わない）。カードは `.ledger-card`。
- **レスポンシブ**: モバイル判定は `useMediaQuery('(max-width: 768px)')` の `isMobile`。この 768px ブレークポイントが全体で共通。

## 重要な注意点（ハマりどころ）

- **Turbopack は `globals.css` の変更を反映しないことがある**（再起動でも直らない）。CSS 変更が computed style に出ないときは `.next` を削除して再起動する。
- **z-index の階層**: Mantine モーダル = 200。`.app-header` は 100、モバイル FAB（Affix）は 150。**200 以上にしない**（フルスクリーンモーダルの閉じるボタンを覆い、PWA でユーザーが戻れなくなる）。
- **カード支払いの会計ロジック**: クレジットカードの支出は購入月に計上し、残高には翌月反映される（実際の引き落としを模す）。`transactionType` / `affectsExpense` / `affectsBalance` フラグで表現。詳細は `docs/user-guide.md`。
- **モバイル入力**: iOS のズーム防止でフォントは 16px、タップ領域は 48px を確保する（`globals.css` の PWA 用ブロック）。

## セキュリティ

- `.env.local` は**コミットしない**（`.gitignore` 済み）。クライアントに出してよい値は `NEXT_PUBLIC_*` のみ。`next.config.ts` の `env` は使わない（`NEXT_PUBLIC_` 無しでもバンドルに埋め込まれるため、秘密情報の混入に気づけない）。
- **Firestore のアクセス制御は `firestore.rules` だけで担保している**（クライアント直結で、サーバー側の API 層が無い）。取引は トップレベル `transactions`（`userId` フィールドで所有者判定）、設定と定期取引は `users/{uid}/` 配下。**コレクション構成を変えたら必ず `firestore.rules` も更新し、`firebase deploy --only firestore:rules` で反映する。**
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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
