# アーキテクチャ / プロジェクト構成

家計簿アプリの構成と、コードから読み取りにくい設計判断をまとめる。
ファイル単位の網羅ではなく「どこに何があるか」と「なぜそうなっているか」を記す。

## ディレクトリ

```
src/
├── app/                # Next.js App Router
│   ├── layout.tsx      # Mantine テーマ + 3 つの Context プロバイダ + PWA メタデータ
│   ├── page.tsx        # 認証ガード → ログイン画面 or ダッシュボード
│   ├── review/         # 年間振り返りページ（/review）
│   ├── settings/       # 設定ページ（/settings）
│   └── globals.css     # デザイントークン（CSS 変数）と "Quiet Ledger" スタイル
├── components/
│   ├── charts/         # Recharts ベース（PieChart, LineChart, SpendingPaceChart, CategoryBreakdown）
│   ├── forms/          # TransactionForm ほか。ResponsiveSelect でモバイルはネイティブ select
│   ├── recurring/      # 定期取引の管理・確認・通知
│   ├── review/         # 年間振り返りの各セクション（使い道/前年比/月別内訳）
│   ├── settings/       # 設定ページの各セクション（カテゴリ/支払方法/予算）
│   └── ui/             # DashboardContent（メイン画面）, TransactionList, 各種モーダル ほか
├── config/             # defaultSettings.ts（新規/既存ユーザーの初期設定）, colorPalette.ts
├── contexts/           # Auth / Settings / Transactions の 3 Context
├── hooks/              # useRecurringTransactions
├── lib/                # firebase.ts（初期化・エミュレータ接続）
├── types/              # index.ts（取引・集計）, settings.ts（ユーザー設定・役割）
└── utils/              # calculations, transactionRules, cardRewards, csvUtils, dateUtils
```

## 状態管理

- **グローバル状態は 3 つの Context**（`src/app/layout.tsx` でラップ）:
  - `AuthContext` — Firebase 認証ユーザーとログイン/ログアウト。
  - `SettingsContext` — `users/{uid}/settings/app` をリアルタイム購読。設定 doc 未作成時は自動シード（既存ユーザー=レガシー設定 / 新規=汎用デフォルト）。集計ルール `rules` と色リゾルバ `getColor` を供給。
  - `TransactionsContext` — 取引を 1 本の Firestore リスナーに集約し、追加/更新/削除を提供。
- **表示中の年月はローカル state ではなく URL クエリ `?month=YYYY-MM`** に持つ。`useSearchParams` で読み、`router.push` で更新する。`selectedYear` は月文字列から導出。

## データフロー

ユーザー操作 → コンポーネント → Context（の mutation メソッド）→ Firestore → リアルタイムリスナー → Context 更新 → 再レンダリング。取引の計算（月次集計・カテゴリ別・前月比）は `src/utils/calculations.ts` で `useMemo` を通して行う。

## 役割ベースの集計（重要な設計）

「投資」「立替金」「カード引き落とし」などの特別扱いは**カテゴリ名ではなくカテゴリに付与された役割（`CategoryRole`）で判定する**。`src/utils/transactionRules.ts` の `createTransactionRules(settings)` がユーザー設定から判定関数一式（`isInvestment`, `isSalaryIncome`, `deriveTransactionFlags` など）を生成し、`SettingsContext` 経由で `rules` として配布される。カテゴリ名で直接分岐するとユーザーがリネームした瞬間に壊れるため避ける。

役割の一覧と意味は `docs/user-guide.md` の「カテゴリ管理」を参照。

## 額面年収の推定（年間振り返り）

アプリが記録するのは口座に入った金額（＝手取り）だけで、控除の記録は持たない。
`/review` の「年収の推移」で使う額面は、`src/utils/tax/estimateGross.ts` が
「額面 → 手取り」を計算する関数を二分探索で反転させて求めた**概算**である。

料率と控除額はすべて `src/utils/tax/rates.ts` に集約してある。**改定があったときは
このファイルだけを更新すればよい**（新しい年分を `TAX_YEARS` に足して `LATEST_TAX_YEAR` を上げる）。
2025年・2026年の「年収の壁」改正で基礎控除と給与所得控除が大きく動いたため、年分ごとに
テーブルを分けている。年を無視して一律の係数を掛けると数十万円ずれる。

前提と、考慮していない控除の一覧は `estimateGross.ts` の冒頭コメントと画面の注記に書いてある。

## カード支払いの会計モデル

クレジットカードの支出は**購入月に支出計上し、残高へは翌月反映**する（実際の引き落としタイミングを模す）。取引は `transactionType`（`normal` / `card_payment` / `card_withdrawal`）と `affectsExpense` / `affectsBalance` フラグで表現し、これらは `rules.deriveTransactionFlags` が導出する。

## デザインシステム "Quiet Ledger"

- フラットな面 + ヘアライン境界。グラデーションやグラスモーフィズムは使わない。
- デザイントークンは `globals.css` の CSS 変数（面 `--app-surface`、インク `--ink-1/2/3`、境界 `--hairline`、セマンティック色 `--income` / `--expense` / `--accent`、角丸・影スケール）。ライト/ダーク両対応。
- カードは `.ledger-card` クラス。

## PWA / モバイル最適化

- `next` の App Router + `public/manifest.json` によるインストール対応。
- モバイル判定は `useMediaQuery('(max-width: 768px)')`（768px が全体共通のブレークポイント）。
- 入力はズーム防止で 16px フォント・48px タップ領域。スワイプ操作は framer-motion。
