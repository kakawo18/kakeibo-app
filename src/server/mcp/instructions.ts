/**
 * MCP サーバーの説明（接続の初期化のときに Claude へ渡す。docs/claude-connector/仕様書.md 6.8）
 *
 * ツールをまたぐ前提だけを書く。ツールごとの使い方はそれぞれの description に書く。
 */
export const KAKEIBO_INSTRUCTIONS = [
  'この MCP サーバーは、利用者の家計簿（個人の収入・支出の記録）を読み取り専用で提供する。',
  '最初に get_kakeibo_overview を呼び、今日の日付・記録のある期間・カテゴリの今の名前と役割を確かめてから、ほかのツールを呼ぶこと。',
  'カテゴリ名は get_kakeibo_overview が返す今の名前を使う。改名前の名前で記録された取引も、今の名前で集計される。',
  '「支出」はアプリの画面と同じく、投資・立替金・「支出に含めない」取引を除いた額である。投資は別に集計している。',
  '収支（net）は「その月の収入−支出」で、口座残高ではない。クレジットカードの支出は引き落とし月ではなく購入月に数える。',
  '日付と月は日本時間。「先月」「今年」は get_kakeibo_overview の today を基準に解釈する。',
  '合計や内訳は自分で足し算せず、get_monthly_summary・get_trend・get_annual_review や search_transactions の totals の値を使う。',
].join('\n');
