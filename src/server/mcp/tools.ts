/**
 * Claude 連携のツールの登録（docs/claude-connector/仕様書.md 6章）
 *
 * 各ツールは「入力の検証 → 必要な期間だけ読む（kakeiboReader）→ 組み立て（summaries.ts）」の順に処理する。
 * ここのツールはすべて読み取り専用（readOnlyHint）。対象の利用者はトークンの uid で決まり、入力からは受け取らない。
 * 記録と編集のツールは writeTools.ts にあり、MCP_WRITE_ENABLED=1 のときだけ登録する。
 * Claude は説明文（description）を読んでツールと引数を選ぶので、説明文も仕様の一部として扱う。
 */
import 'server-only';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getCurrentMonth } from '@/utils/dateUtils';
import {
  readRecordedPeriod,
  readRecurringTransactions,
  readSettings,
  readTransactions,
} from '../kakeiboReader';
import { isMcpWriteEnabled } from '../config';
import { UserFacingError } from '../errors';
import { runTool } from './result';
import { registerWriteTools } from './writeTools';
import {
  DAY_PATTERN,
  MONTH_PATTERN,
  daysInclusive,
  monthStart,
  monthsBetween,
  nextDay,
  nextMonthStart,
  parseDay,
  shiftMonth,
} from './dates';
import {
  buildAnnualReview,
  buildMonthlySummary,
  buildOverview,
  buildRecurringList,
  buildSearchResult,
  buildTrend,
} from './summaries';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

/** 金額・支出の数え方の共通の説明（各ツールの説明文の末尾に付ける） */
const AMOUNT_NOTE = '金額は円。支出からは投資・立替金と「支出に含めない」取引を除いている（アプリの画面と同じ）。';

const day = z.string().regex(DAY_PATTERN, 'YYYY-MM-DD で指定してください');
const month = z.string().regex(MONTH_PATTERN, 'YYYY-MM で指定してください');
const names = z.array(z.string().min(1).max(50)).max(30);

const MAX_TREND_MONTHS = 36;
const MAX_SEARCH_DAYS = 366;

export const registerKakeiboTools = (server: McpServer): void => {
  server.registerTool(
    'get_kakeibo_overview',
    {
      title: '家計簿の概要',
      description:
        '家計簿の全体像を返す。最初に呼ぶこと。今日の日付（日本時間）、記録のある期間、月間予算、' +
        'カテゴリとサブカテゴリの一覧（今の名前・役割・以前の名前）、支払方法、役割の意味がわかる。' +
        '他のツールにカテゴリ名を渡すときは、ここで返る今の名前を使う。',
      annotations: { title: '家計簿の概要', ...READ_ONLY },
    },
    async (ctx) =>
      runTool('get_kakeibo_overview', ctx, async (uid) => {
        // 記録のある期間の読み出し（最も古い取引を引くには複合インデックスが要る）が失敗しても、
        // 概要のほかの項目は返す。最初に呼ぶツールなので、ここが止まるとほかのツールも使われなくなる
        const period = readRecordedPeriod(uid).catch((error: unknown) => {
          console.error(
            'MCP tool get_kakeibo_overview: recorded period unavailable:',
            error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error'
          );
          return 'unavailable' as const;
        });
        const [settings, recordedPeriod] = await Promise.all([readSettings(uid), period]);
        return buildOverview(settings, recordedPeriod, new Date());
      })
  );

  server.registerTool(
    'search_transactions',
    {
      title: '取引の検索',
      description:
        '条件に合う取引を探して一覧と合計を返す。「先月のコンビニの支出」「メモに〇〇とある取引」などに使う。' +
        `期間を省くと、to（既定は今日）の月から2か月前の1日から to まで。期間は最長${MAX_SEARCH_DAYS}日。` +
        'totals は件数の上限で切る前の全件の合計で、countedExpense / countedIncome はアプリの集計に入る分だけの合計。' +
        '月ごとの合計やカテゴリ別の内訳が知りたいだけなら get_monthly_summary か get_trend を使う。' +
        AMOUNT_NOTE,
      inputSchema: z.object({
        from: day.optional().describe('この日を含む（YYYY-MM-DD）'),
        to: day.optional().describe('この日を含む（YYYY-MM-DD）。既定は今日'),
        type: z.enum(['income', 'expense']).optional().describe('収入か支出か。省くと両方'),
        categories: names.optional().describe('カテゴリ名またはサブカテゴリ名（get_kakeibo_overview の今の名前）'),
        paymentMethods: names.optional().describe('支払方法の名前'),
        keyword: z.string().min(1).max(50).optional().describe('メモ・カテゴリ・サブカテゴリの部分一致'),
        minAmount: z.number().int().min(0).optional(),
        maxAmount: z.number().int().min(0).optional(),
        sort: z.enum(['date_desc', 'date_asc', 'amount_desc']).default('date_desc'),
        limit: z.number().int().min(1).max(200).default(50).describe('返す件数（合計は全件で計算する）'),
      }),
      annotations: { title: '取引の検索', ...READ_ONLY },
    },
    async (input, ctx) =>
      runTool('search_transactions', ctx, async (uid) => {
        const today = new Date();
        const to = input.to ? parseDay(input.to, 'to') : new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const from = input.from
          ? parseDay(input.from, 'from')
          : monthStart(shiftMonth(`${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}`, 2));
        if (from > to) throw new UserFacingError('from は to より前の日付にしてください');
        // 期間内の取引はすべて読むので、1回に読む量を抑える（#179）
        if (daysInclusive(from, to) > MAX_SEARCH_DAYS) {
          throw new UserFacingError(`期間は最長${MAX_SEARCH_DAYS}日です。分けて呼んでください`);
        }
        if (input.minAmount !== undefined && input.maxAmount !== undefined && input.minAmount > input.maxAmount) {
          throw new UserFacingError('minAmount は maxAmount 以下にしてください');
        }

        const [settings, transactions] = await Promise.all([
          readSettings(uid),
          readTransactions(uid, { from, before: nextDay(to) }),
        ]);
        return buildSearchResult(transactions, settings, { ...input, from, to });
      })
  );

  server.registerTool(
    'get_monthly_summary',
    {
      title: '月の収支',
      description:
        '1か月分の収入・支出・収支（収入−支出。口座残高ではない）、投資額、前月の値と増減率、' +
        'カテゴリ別の内訳（アプリの円グラフと同じく、サブカテゴリのある取引はサブカテゴリ名でまとめる）、' +
        '月間予算との比較（支出ペース除外のカテゴリを除き、今月は今日までの支出で比べる）、カード還元を返す。' +
        'カードの支出は引き落とし月ではなく購入月に数える。' +
        AMOUNT_NOTE,
      inputSchema: z.object({
        month: month.optional().describe('YYYY-MM。既定は今月'),
      }),
      annotations: { title: '月の収支', ...READ_ONLY },
    },
    async ({ month: target = getCurrentMonth() }, ctx) =>
      runTool('get_monthly_summary', ctx, async (uid) => {
        const [settings, transactions] = await Promise.all([
          readSettings(uid),
          readTransactions(uid, { from: monthStart(shiftMonth(target, 1)), before: nextMonthStart(target) }),
        ]);
        return buildMonthlySummary(transactions, settings, target, new Date());
      })
  );

  server.registerTool(
    'get_trend',
    {
      title: '月ごとの推移',
      description:
        `複数の月の収入・支出・収支・投資額と、カテゴリ別の支出の推移を返す（最長${MAX_TREND_MONTHS}か月）。` +
        '「ここ半年の食費の推移」「去年からの支出の変化」などに使う。期間を省くと今月までの12か月。' +
        AMOUNT_NOTE,
      inputSchema: z.object({
        fromMonth: month.optional().describe('YYYY-MM。既定は toMonth の11か月前'),
        toMonth: month.optional().describe('YYYY-MM。既定は今月'),
        categories: names.optional().describe('カテゴリ別の内訳をこのカテゴリだけにする（今の名前）'),
      }),
      annotations: { title: '月ごとの推移', ...READ_ONLY },
    },
    async ({ fromMonth, toMonth = getCurrentMonth(), categories }, ctx) =>
      runTool('get_trend', ctx, async (uid) => {
        const from = fromMonth ?? shiftMonth(toMonth, 11);
        const span = monthsBetween(from, toMonth);
        if (span < 0) throw new UserFacingError('fromMonth は toMonth 以前の月にしてください');
        if (span >= MAX_TREND_MONTHS) {
          throw new UserFacingError(`期間は最長${MAX_TREND_MONTHS}か月です。分けて呼んでください`);
        }

        const [settings, transactions] = await Promise.all([
          readSettings(uid),
          readTransactions(uid, { from: monthStart(from), before: nextMonthStart(toMonth) }),
        ]);
        return buildTrend(transactions, settings, from, toMonth, categories);
      })
  );

  server.registerTool(
    'get_annual_review',
    {
      title: '年間の振り返り',
      description:
        '1年分の給与収入・その他の収入・支出・投資額・手元に残った額（手取り−支出−投資）・貯蓄率（投資÷給与収入）、' +
        '月ごとの内訳、カテゴリ別の前年比、額面年収の推定（手取りから逆算した概算）を返す。アプリの「振り返り」タブと同じ内容。' +
        AMOUNT_NOTE,
      inputSchema: z.object({
        year: z.number().int().min(2000).max(2100).optional().describe('西暦。既定は今年'),
      }),
      annotations: { title: '年間の振り返り', ...READ_ONLY },
    },
    async ({ year = new Date().getFullYear() }, ctx) =>
      runTool('get_annual_review', ctx, async (uid) => {
        const [settings, transactions] = await Promise.all([
          readSettings(uid),
          readTransactions(uid, { from: new Date(year - 1, 0, 1), before: new Date(year + 1, 0, 1) }),
        ]);
        return buildAnnualReview(transactions, settings, year);
      })
  );

  server.registerTool(
    'list_recurring_transactions',
    {
      title: '定期取引の一覧',
      description:
        '毎月の定期取引（家賃・サブスクなど）の一覧を返す。金額・カテゴリ・実行日・有効かどうかと、今月もう記録したかがわかる。金額は円。',
      annotations: { title: '定期取引の一覧', ...READ_ONLY },
    },
    async (ctx) =>
      runTool('list_recurring_transactions', ctx, async (uid) => {
        const thisMonth = getCurrentMonth();
        const [recurring, transactions] = await Promise.all([
          readRecurringTransactions(uid),
          readTransactions(uid, { from: monthStart(thisMonth), before: nextMonthStart(thisMonth) }),
        ]);
        return buildRecurringList(recurring, transactions, thisMonth);
      })
  );

  if (isMcpWriteEnabled()) registerWriteTools(server);
};
