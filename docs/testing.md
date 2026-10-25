# テストと会計の期待値

集計金額や保存内容が変わっていないことを、テストで確かめるための資料。
テストの動かし方と追加の手順は `AGENTS.md` の「テスト」を正とし、ここでは**何を正しい金額とみなしているか**とその根拠をまとめる（#121）。

## 動かし方（要約）

```bash
npm test                # 純関数の単体テスト（Firebase の認証情報は不要）
npm run test:emulator   # Firestore エミュレータで保存形式とルールを検証（Java 21 が必要）
```

CI（`.github/workflows/ci.yml`）で lint・型チェック・両方のテストが走る。

## テスト用の架空データ

`src/test/fixtures.ts` の `testSettings` / `testRules` / `tx()` を使う。本番の家計データは使わない。

| カテゴリ | サブカテゴリ | 役割 |
|---|---|---|
| 食費（支出） | 外食 | — |
| 固定費（支出） | 家賃 / 積立NISA | 家賃 = 支出ペース除外、積立NISA = 投資（サブカテゴリにだけ役割） |
| 投資（支出） | — | 投資 |
| 立替（支出） | — | 立替金 |
| 給与（収入） | 給料 / 賞与 | 給与収入 |
| その他（収入） | 配当収入 | —（給与として扱わない） |
| 立替回収（収入） | — | 立替回収 |

支払方法は 現金（現金扱い）/ 楽天カード（還元 1%）/ 還元なしカード。

## 代表的な会計ケースと期待値

根拠の節番号は `docs/機能仕様書.md`。

| ケース | 期待値 | 根拠 | テスト |
|---|---|---|---|
| 通常の収入・支出 | 月の収支 = 収入 − 支出 | §6 ホーム画面、`MonthlyData.net` は月間収支（口座残高ではない） | `calculations.test.ts` calculateMonthlyData |
| カード払い | **購入月**の支出に入る。引き落とし月には計上しない | §2.4 クレジットカード払いの会計モデル | 同上（楽天カードの食費 40,000 が 3月の支出） |
| `affectsExpense = false`（過去の「カード引き落とし」） | 支出に入れない（購入月に計上済みのため二重に数えない） | §2.3 / §2.4 | 同上、`calculateDailyTotals`、`calculateCategoryTrend` |
| 投資（カテゴリ・サブカテゴリどちらの役割でも） | 支出から外し、年間投資額に入れる | §3.2 役割 | `calculations.test.ts`、`annualSummary.test.ts` |
| 立替金 | 支出から外す | §3.2 | 同上 |
| 立替回収 | 収入から外す | §3.2 | 同上 |
| 給与と配当 | 給与収入は給与の役割を持つものだけ。配当は「その他の収入」 | §3.2、§10 額面年収の推定 | `annualSummary.test.ts` calculateAnnualSummaries |
| 年間の手元に残った額・貯蓄率 | 手取り − 支出 − 投資 / 投資 ÷ 給与収入 | §9 年間振り返り | 同上 |
| 年末年始 | 12/31 と 1/1 は別の月・別の年に入る（端末のローカル時刻で判定） | §13 月次ナビゲーション | `calculations.test.ts` 年をまたいでも月が連続する |
| 取引の無い月 | 0 で埋めて月を連続させる（グラフが飛ばない） | #118 | `calculations.test.ts`、`annualSummary.test.ts` |
| 画面ごとの一致 | ホームの支出・円グラフの合計・カレンダーの日別合計・推移グラフは同じ除外ルール | #100 | `calculations.test.ts` |
| 月間予算との比較 | 共通の除外に加えて「支出ペース除外」の取引も外す。今月は今日までの取引だけ数える。ホームの支出ペースと Claude 連携で同じ関数を使う | `docs/claude-connector/仕様書.md` 6.4 | `budget.test.ts` |
| Admin SDK の読み出し | 指定した uid の取引・設定・定期取引だけを返す（ルールを通らないのでコードで保証する） | `docs/claude-connector/仕様書.md` 7.2 | `src/server/kakeiboReader.emulator.test.ts` |
| Claude 連携の認可 | 認可コードは5分・1回限り、PKCE（S256）必須、redirect_uri は完全一致。リフレッシュトークンはローテーションし、60秒より後の再使用で接続ごと消す。許可リスト外の uid は拒否 | `docs/claude-connector/仕様書.md` 5章 | `src/server/oauth/oauth.test.ts`、`oauth.emulator.test.ts` |
| Claude 連携の接続の解除・掃除 | 解除は本人のリフレッシュトークンだけを消す。使用済みのトークンは24時間で期限切れ、期限切れのコードとトークンは発行のたびに消す | `docs/claude-connector/仕様書.md` 5.9・5.10 | `src/server/oauth/oauth.emulator.test.ts` |
| Claude 連携のツールの数値 | ホーム・振り返りと同じ domain の関数で集計し、改名前のカテゴリも今の名前で数える | `docs/claude-connector/仕様書.md` 6章 | `src/server/mcp/summaries.test.ts` |
| カテゴリの改名・削除 | 過去の取引の集計は変わらない（以前の名前・アーカイブ） | §3.1 | `categorySettings.test.ts` |
| 編集 | メモだけ直しても取引タイプ・支出に含めるかは変わらない | §2.3、#99 | `transactionRules.test.ts` resolveFlagsOnEdit |
| 定期取引の記録 | 定期取引 ID と対象月で記録済みを判定し、同じ月は1件にまとまる | §8、#101 | `recurring.test.ts` |
| 定期取引の毎月の合計 | 有効なものだけを足し、役割で支出・投資・立替などに分ける。内訳は今のカテゴリ名でまとめる | §8.4 | `recurring.test.ts` summarizeRecurring |
| CSV の往復 | 改行入りのメモ・取引タイプ・支出に含めるかを保ったまま戻せる | §11、#99 #102 | `csvUtils.test.ts` |
| 保存形式 | 作成と部分更新を分け、更新では undefined = 変更しない / 空文字 = 項目を消す | `AGENTS.md`、#98 | `src/data/*.test.ts`、`*.emulator.test.ts` |

## テストを足すとき

- 不具合を直すときは、先に再現するテストを書いて失敗することを確かめてから直す。既知の不具合の挙動を正しい仕様として固定しない。
- 新しい会計ルールを入れたら、この表に1行足し、根拠（仕様書の節や issue）を書く。
