# アーキテクチャ / プロジェクト構成

家計簿アプリの構成と、コードから読み取りにくい設計判断をまとめる。
ファイル単位の網羅ではなく「どこに何があるか」と「なぜそうなっているか」を記す。

## ディレクトリ

```
src/
├── app/                # Next.js App Router
│   ├── layout.tsx      # Mantine テーマ + 4 つの Context プロバイダ + PWA メタデータ
│   ├── (tabs)/         # タブ配下。ルートグループなので URL には現れない
│   │   ├── layout.tsx  # 認証ガード + ローディング + 共通ヘッダー + タブバー
│   │   ├── page.tsx    # ホーム（/）
│   │   ├── history/    # 履歴（/history）リスト⇄カレンダー
│   │   ├── review/     # 年間振り返り（/review）
│   │   └── settings/   # 設定（/settings）
│   └── globals.css     # デザイントークン（CSS 変数）と "Quiet Ledger" スタイル
├── components/
│   ├── charts/         # Recharts ベース（PieChart, LineChart, SpendingPaceChart, CategoryBreakdown）
│   ├── forms/          # TransactionForm ほか。ResponsiveSelect でモバイルはネイティブ select
│   ├── nav/            # タブ定義・タブバー・共通ヘッダー
│   ├── recurring/      # 定期取引の管理・確認・通知
│   ├── review/         # 年間振り返りの各セクション（使い道/月別内訳）
│   ├── settings/       # 設定ページの各セクション（カテゴリ/支払方法/予算）
│   └── ui/             # DashboardContent（メイン画面）, TransactionList, 各種モーダル ほか
├── config/             # defaultSettings.ts（新規/既存ユーザーの初期設定）, colorPalette.ts
├── contexts/           # Auth / Settings / Transactions / RecurringTransactions の 4 Context、書き込み結果（writeResult）・未送信の変更（pendingWrites）
├── data/               # Firestore の読み書き（*Repository）・保存形式の変換（*Serializer）・CSV（csvUtils・一括保存）
├── hooks/              # useSelectedMonth
├── lib/                # firebase.ts（初期化・エミュレータ接続）
├── types/              # index.ts（取引・集計）, settings.ts（ユーザー設定・役割）
├── domain/             # 会計の計算: transactionRules, calculations, annualSummary, cardRewards, categorySettings, recurring, tax/
└── utils/              # 汎用処理: dateUtils, validation
```

## 状態管理

- **グローバル状態は 4 つの Context**（`src/app/layout.tsx` でラップ）:
  - `AuthContext` — Firebase 認証ユーザーとログイン/ログアウト。
  - `SettingsContext` — `users/{uid}/settings/app` をリアルタイム購読。設定 doc 未作成時は自動シード（既存ユーザー=レガシー設定 / 新規=汎用デフォルト）。集計ルール `rules` と色リゾルバ `getColor` を供給。
  - `TransactionsContext` — 取引を 1 本の Firestore リスナーに集約し、追加/更新/削除を提供。
  - `RecurringTransactionsContext` — 定期取引を 1 本の Firestore リスナーに集約する（以前はフックを呼ぶコンポーネントごとに購読しており、閉じた管理モーダルも購読していた）。
- **詳細モーダルの集計は中身のコンポーネントに置く**。Mantine の `Modal` は閉じると中身をアンマウントするので、閉じているあいだは集計が走らない（年間投資履歴・貯蓄率詳細・カード還元）。
- **表示中の年月はローカル state ではなく URL クエリ `?month=YYYY-MM`** に持つ。読み書きは `useSelectedMonth`（`src/hooks/`）に集約し、UI は `MonthNav` を使う。`selectedYear` は月文字列から導出。タブバーは `carriesMonth` が立ったタブ（ホーム・履歴）同士でこのクエリを引き継ぐ（`tabHref`）。URL に無ければ付けないので、起動直後は当月になる。
- **グラフの表示設定も設定ドキュメントに置く**（`chartPreferences`）。端末の `localStorage` は iOS のホーム画面アプリで起動をまたいで消えることがあり、選択が既定に戻ってしまうため使わない。
- **どのタブを開いているかも URL（パス）が持つ**。タブを state で切り替えないのは、月が URL・タブが state という二重管理を避けるため。副作用として、タブを切り替えるとスクロール位置は保持されない（各タブは上から読む画面なので許容している）。

## データフロー

### 依存の向き（#123）

```
app / components ─→ contexts ─→ data ─→ domain ─→ utils / types
      │                              ↑
      └──────────────────────────────┘（画面は集計関数を直接呼ぶ）
```

- `src/domain/`: 会計の計算（役割による判定・月次/年次の集計・カード還元・額面の推定・カテゴリの改名とアーカイブ）。React・Next・Firebase・Mantine にも、画面・Context・データアクセスにも依存しない。取引・設定・対象期間・基準日はすべて引数で受け取る。ESLint の `no-restricted-imports` で検査している
- `src/data/`: Firestore の読み書きと保存形式・CSV の変換。domain を使ってよい（CSV の取り込みで取引タイプを導出するなど）
- `src/contexts/`: ユーザーごとの状態と購読の開始・解除。data と domain を使う
- 表示の都合（色・書式）は画面側。例えば円グラフの色は `calculateCategoryChartData` では付けず、`PieChart` がテーマに合わせて付ける
- 月の収支は `MonthlyData.net`（収入 − 支出）、年間振り返りの「手元に残った額」は `remaining`（収入 − 支出 − 投資）。どちらも口座残高ではない（以前はどちらも `balance` という名前だった）

ユーザー操作 → コンポーネント → Context（の mutation メソッド）→ Repository（`src/data/*Repository.ts`）→ Firestore → リアルタイムリスナー → Context 更新 → 再レンダリング。

Firestore の操作（購読・作成・更新・削除・初期設定の作成）と保存形式の変換は `src/data/` に置き、Context はユーザーごとの状態・エラー・購読の開始と解除だけを持つ（#122）。Repository は `db` を引数で受け取るので、エミュレータのテストから同じ関数を呼んで契約を確かめている（`repositories.emulator.test.ts`）。

Firestore は端末の永続キャッシュ（IndexedDB）付きで初期化している（`src/lib/firebase.ts`）。書き込みはまず端末のキャッシュに入りリスナーへすぐ反映されるが、Promise はサーバーの確定まで解決しない。オフラインで待ち続けないよう、Context の書き込みは `settle()`（`src/contexts/writeResult.ts` → `src/data/pendingWrite.ts`）を通し、オフライン時は `'queued'` を返す。画面は `notifySaved(result, ...)` で通知を出し分ける。取引の計算（月次集計・カテゴリ別・前月比）は `src/domain/calculations.ts` で `useMemo` を通して行う。

## 役割ベースの集計（重要な設計）

「投資」「立替金」などの特別扱いは**カテゴリ名ではなくカテゴリに付与された役割（`CategoryRole`）で判定する**。`src/domain/transactionRules.ts` の `createTransactionRules(settings)` がユーザー設定から判定関数一式（`isInvestment`, `isSalaryIncome`, `deriveTransactionFlags` など）を生成し、`SettingsContext` 経由で `rules` として配布される。カテゴリ名で直接分岐するとユーザーがリネームした瞬間に壊れるため避ける。

取引はカテゴリ名の文字列を持つため、改名した旧名は設定の `aliases`（以前の名前）に、使用中のまま削除したカテゴリは `archived` として設定に残し、`createTransactionRules` が旧名にも同じ役割を当てる（#97）。取引の分類・表示に使う名前は `t.category` ではなく `rules.categoryName(t)` / `rules.subcategoryName(t)` / `rules.chartKey(t)`（旧名を今の名前に読み替える）を使う。改名・削除の処理は `src/domain/categorySettings.ts`。

役割の一覧と意味は `docs/user-guide.md` の「カテゴリ管理」を参照。

## 額面年収の推定（年間振り返り）

アプリが記録するのは口座に入った金額（＝手取り）だけで、控除の記録は持たない。
`/review` の「年収の推移」で使う額面は、`src/domain/tax/estimateGross.ts` が
「額面 → 手取り」を計算する関数を二分探索で反転させて求めた**概算**である。

料率と控除額はすべて `src/domain/tax/rates.ts` に集約してある。**改定があったときは
このファイルだけを更新すればよい**（新しい年分を `TAX_YEARS` に足して `LATEST_TAX_YEAR` を上げる）。
2025年・2026年の「年収の壁」改正で基礎控除と給与所得控除が大きく動いたため、年分ごとに
テーブルを分けている。年を無視して一律の係数を掛けると数十万円ずれる。

前提と、考慮していない控除の一覧は `estimateGross.ts` の冒頭コメントと画面の注記に書いてある。

## カード支払いの会計モデル

クレジットカードの支出は**購入月に支出計上する**。取引は `transactionType`（`normal` / `card_payment`）と `affectsExpense` フラグで表現し、これらは `rules.deriveTransactionFlags` が導出する。

`transactionType` には `card_withdrawal` というレガシー値もある。かつて「カード引き落とし」という役割を付けたカテゴリの取引に付いていたもので、カード支払い分との二重計上を防ぐために支出集計から外していた。**この役割は廃止済み**で新しい取引には付かないが、過去のドキュメントは値を持っているため型からは外していない。集計から外れるかどうかは `affectsExpense` が決めるので、この値の有無で過去の集計結果は変わらない。

## ナビゲーション

タブの定義は `src/components/nav/tabs.ts` の配列が唯一の情報源。増やすときはここに足す。
`AppTabBar` はモバイル（下部固定バー）とデスクトップ（ヘッダー直下の横並び）の両方を描画し、
**出し分けは JS のメディアクエリではなく CSS**（Mantine の `hiddenFrom` / `visibleFrom`）で行う。
`useMediaQuery` は初回レンダリングで `undefined` を返すため、モバイルで一瞬デスクトップ用の
タブ列が見えてしまうのを避けている。

z-index は ヘッダー / タブバー = 100、取引追加の FAB = 150、Mantine のモーダル = 200。
タブバーの高さは `--tabbar-height` で定義し、FAB の位置と `.tab-page` の下余白が参照する。

## デザインシステム "Quiet Ledger"

- フラットな面 + ヘアライン境界。グラデーションやグラスモーフィズムは使わない。
- デザイントークンは `globals.css` の CSS 変数（面 `--app-surface`、インク `--ink-1/2/3`、境界 `--hairline`、セマンティック色 `--income` / `--expense` / `--accent`、角丸・影スケール）。ライト/ダーク両対応。
- カードは `.ledger-card` クラス。

## PWA / モバイル最適化

- `next` の App Router + `public/manifest.json` によるインストール対応。
- モバイル判定は `useMediaQuery('(max-width: 768px)')`（768px が全体共通のブレークポイント）。
- 入力はズーム防止で 16px フォント・48px タップ領域。スワイプ操作は framer-motion（`SwipeArea` に集約）。
