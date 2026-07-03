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

- `.env.local` は**コミットしない**（`.gitignore` 済み）。Firebase 設定は `NEXT_PUBLIC_*` としてクライアントに露出する前提。
- Firestore のアクセス制御はセキュリティルールで担保する（各ユーザーは `users/{uid}/**` のみ read/write。ルール例は `docs/deployment.md`）。
- 本番デプロイ先ドメインは Firebase Console の Authentication → Authorized domains に追加が必要。

## コミット / PR

- コミットは日本語。Conventional Commits 形式のプレフィックス（`feat:` / `fix:` / `refactor:` / `chore:` / `style:`）を付けるのが基本。
- `main` へ直接コミットしない。フィーチャーブランチで作業し PR を作る。
- push で Vercel が自動デプロイ（本番 = `main`、PR = プレビュー）。
