/**
 * Claude からの取引の記録と編集のツール（docs/claude-connector/書き込み仕様書.md 4章・5章）
 *
 * 記録は「確認」と「記録」の2回の呼び出しに分ける。確認のツール（preview_*）は何も書かず、整えた内容・
 * 警告・確認トークンを返す。記録のツールは確認トークンだけを受け取り、その中身を書く。利用者が見て
 * 承認した内容と違うものは書けない。確認のツールには読み取り専用の印を付け、記録のツールには付けない
 * （claude.ai は記録のツールを呼ぶ前に利用者の承認を求める）。
 *
 * どのツールも、トークンの scope に kakeibo.write があるときだけ動く。MCP_WRITE_ENABLED=1 のときだけ登録する。
 * 処理は関数に分けて書き、エミュレータのテストから直接呼ぶ（writeTools.emulator.test.ts）。
 */
import 'server-only';
import { z } from 'zod';
import dayjs from 'dayjs';
import type { McpServer, ServerContext } from '@modelcontextprotocol/server';
import { createTransactionRules } from '@/domain/transactionRules';
import { getMcpConfig } from '../config';
import { UserFacingError } from '../errors';
import { readSettings, readTransaction, readTransactions } from '../kakeiboReader';
import { createOwnTransaction, updateOwnTransaction } from '../kakeiboWriter';
import { WRITE_SCOPE } from '../oauth/params';
import { runTool } from './result';
import { DAY_PATTERN, nextDay, parseDay } from './dates';
import {
  ConfirmationConfig,
  signConfirmation,
  transactionIdFor,
  verifyConfirmation,
} from './confirmationToken';
import { duplicateWarnings, findPossibleDuplicates } from './duplicates';
import {
  NewTransactionRequest,
  TransactionChanges,
  draftNewTransaction,
  draftTransactionChange,
  toNewTransactionInput,
  toTransactionUpdates,
  toTransactionView,
} from './transactionDraft';

const FAILURE_MESSAGE = '家計簿への記録に失敗しました。記録されたかどうかを search_transactions で確かめてから、もう一度試してください。';

const NOT_FOUND = '取引が見つかりません。search_transactions で ID を確かめてください';

/** 確認の結果に添える、次に行うことの説明（説明文と重ねて、毎回の結果でも念を押す） */
const CONFIRM_NOTE =
  'この内容と警告を利用者に見せて、応答を終えること。利用者が次の発言で承認したときだけ、confirmationToken を渡して記録する。内容を変えるときは確認からやり直す。';

/** 確認トークンの期限（日本時間。UTC のままだと Claude が時刻を読み違えうる） */
const japanTime = (date: Date): string => dayjs(date).format('YYYY-MM-DDTHH:mm:ssZ');

const PREVIEW = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

const confirmationConfig = (): ConfirmationConfig => {
  const { origin, tokenSecret } = getMcpConfig();
  return { origin, tokenSecret };
};

/** この接続に書き込みの許可があるか。無ければ、接続し直すよう案内する */
const requireWriteScope = (ctx: ServerContext): void => {
  const scopes = ctx.http?.authInfo?.scopes ?? [];
  if (!scopes.includes(WRITE_SCOPE)) {
    throw new UserFacingError(
      'この接続には記録の許可がありません。claude.ai でコネクタを接続し直し、同意画面で許可してください。'
    );
  }
};

export interface WriteOptions {
  now?: Date;
  config?: ConfirmationConfig;
}

// ============================================================
// 追加
// ============================================================

export const previewAddTransaction = async (uid: string, request: NewTransactionRequest, options: WriteOptions = {}) => {
  const { now = new Date(), config = confirmationConfig() } = options;
  const settings = await readSettings(uid);
  const { draft, view, warnings } = draftNewTransaction(request, settings, now);

  const dayStart = parseDay(draft.date, 'date');
  const sameDay = await readTransactions(uid, { from: dayStart, before: nextDay(dayStart) });
  const { token, expiresAt } = await signConfirmation(uid, { action: 'add', draft }, config, now);

  return {
    transaction: view,
    warnings: [...duplicateWarnings(findPossibleDuplicates(draft, sameDay), settings), ...warnings],
    confirmationToken: token,
    expiresAt: japanTime(expiresAt),
    note: CONFIRM_NOTE,
  };
};

export const addTransaction = async (uid: string, confirmationToken: string, options: WriteOptions = {}) => {
  const { now = new Date(), config = confirmationConfig() } = options;
  const { confirmation, jti } = await verifyConfirmation(confirmationToken, uid, config, now);
  if (confirmation.action !== 'add') {
    throw new UserFacingError('これは編集の確認トークンです。編集は update_transaction に渡してください');
  }
  const settings = await readSettings(uid);
  const input = toNewTransactionInput(confirmation.draft, settings, now);
  const { transaction, created } = await createOwnTransaction(uid, transactionIdFor(uid, jti), input, now);

  return {
    transaction: toTransactionView(transaction, createTransactionRules(settings)),
    // 同じ確認トークンで呼び直したとき（通信のやり直しなど）。新しくは記録していない
    alreadyRecorded: !created,
  };
};

// ============================================================
// 編集
// ============================================================

export const previewUpdateTransaction = async (
  uid: string,
  id: string,
  request: TransactionChanges,
  options: WriteOptions = {}
) => {
  const { now = new Date(), config = confirmationConfig() } = options;
  const [settings, existing] = await Promise.all([readSettings(uid), readTransaction(uid, id)]);
  if (!existing) throw new UserFacingError(NOT_FOUND);

  const { changes, changedFields, before, after, warnings } = draftTransactionChange(existing, request, settings, now);
  if (changedFields.length === 0) {
    throw new UserFacingError('変える項目がありません（指定した値は今の値と同じです）');
  }
  const { token, expiresAt } = await signConfirmation(uid, { action: 'update', transactionId: id, changes }, config, now);

  return {
    before,
    after,
    changedFields,
    warnings,
    confirmationToken: token,
    expiresAt: japanTime(expiresAt),
    note: CONFIRM_NOTE,
  };
};

export const updateTransaction = async (uid: string, confirmationToken: string, options: WriteOptions = {}) => {
  const { now = new Date(), config = confirmationConfig() } = options;
  const { confirmation } = await verifyConfirmation(confirmationToken, uid, config, now);
  if (confirmation.action !== 'update') {
    throw new UserFacingError('これは追加の確認トークンです。追加は add_transaction に渡してください');
  }
  const [settings, existing] = await Promise.all([
    readSettings(uid),
    readTransaction(uid, confirmation.transactionId),
  ]);
  if (!existing) throw new UserFacingError(NOT_FOUND);
  const rules = createTransactionRules(settings);

  const updates = toTransactionUpdates(existing, confirmation.changes, settings, now);
  if (!updates) {
    // 同じ確認トークンで呼び直したとき。もう反映されている
    return { transaction: toTransactionView(existing, rules), alreadyApplied: true };
  }
  const updated = await updateOwnTransaction(uid, existing.id, updates, now);
  return { transaction: toTransactionView(updated, rules), alreadyApplied: false };
};

// ============================================================
// ツールの登録
// ============================================================

const day = z.string().regex(DAY_PATTERN, 'YYYY-MM-DD で指定してください');
// 長さの上限はアプリと同じ基準で transactionDraft が日本語の説明つきで確かめる。ここは極端な入力だけを弾く
const name = z.string().max(100);
const memo = z.string().max(1_000);
const token = z.string().min(1).max(8_000);
const transactionId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, '取引の ID は search_transactions の結果の id を使ってください');

export const registerWriteTools = (server: McpServer): void => {
  server.registerTool(
    'preview_add_transaction',
    {
      title: '取引の追加の確認',
      description:
        '取引を1件追加する前の確認。何も書き込まない。入力を家計簿の設定で検査・整え、記録される内容・' +
        '集計での扱い・警告（同じ日・同じ金額の取引がある、日付が未来）と、確認トークンを返す。' +
        '返ってきた内容と警告を利用者に見せて応答を終え、利用者が承認したら add_transaction に confirmationToken を渡す。' +
        'カテゴリ・サブカテゴリ・支払方法は get_kakeibo_overview が返す今の名前を使う。金額は円の整数。',
      inputSchema: z.object({
        date: day.describe('取引の日（日本時間の YYYY-MM-DD）'),
        type: z.enum(['income', 'expense']).describe('収入か支出か'),
        amount: z.number().int().describe('金額（円）。1〜1,000,000,000'),
        category: name.describe('カテゴリの今の名前'),
        subcategory: name.optional().describe('サブカテゴリの今の名前'),
        paymentMethod: name.optional().describe('支払方法の名前（支出だけ）'),
        description: memo.optional().describe('メモ（200文字まで）。レシートなら店名、まとめた記録なら内訳'),
      }),
      annotations: { title: '取引の追加の確認', ...PREVIEW },
    },
    async (input, ctx) =>
      runTool(
        'preview_add_transaction',
        ctx,
        (uid) => {
          requireWriteScope(ctx);
          return previewAddTransaction(uid, input);
        },
        FAILURE_MESSAGE
      )
  );

  server.registerTool(
    'add_transaction',
    {
      title: '取引の追加',
      description:
        'preview_add_transaction で確認した取引を1件記録する。利用者が確認の内容を見て承認した後にだけ呼ぶ。' +
        '入力は確認トークンだけで、確認した内容がそのまま記録される（内容を変えるときは確認からやり直す）。' +
        '同じトークンで呼び直しても二重には記録しない（alreadyRecorded が true になる）。確認トークンの期限は30分。',
      inputSchema: z.object({ confirmationToken: token.describe('preview_add_transaction が返した confirmationToken') }),
      annotations: {
        title: '取引の追加',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input, ctx) =>
      runTool(
        'add_transaction',
        ctx,
        (uid) => {
          requireWriteScope(ctx);
          return addTransaction(uid, input.confirmationToken);
        },
        FAILURE_MESSAGE
      )
  );

  server.registerTool(
    'preview_update_transaction',
    {
      title: '取引の編集の確認',
      description:
        '記録済みの取引を1件編集する前の確認。何も書き込まない。変更前と変更後・変わる項目・確認トークンを返す。' +
        '指定しなかった項目は変えない。サブカテゴリ・支払方法・メモは空文字で消える。カテゴリを変えてサブカテゴリを指定しなければ、サブカテゴリは消える。' +
        '収入と支出は切り替えられない。取引の ID は search_transactions の結果の id を使う。' +
        '変更前と変更後を利用者に見せて応答を終え、利用者が承認したら update_transaction に confirmationToken を渡す。',
      inputSchema: z.object({
        id: transactionId.describe('取引の ID（search_transactions の結果の id）'),
        date: day.optional().describe('新しい日付（YYYY-MM-DD）'),
        amount: z.number().int().optional().describe('新しい金額（円）'),
        category: name.optional().describe('新しいカテゴリの今の名前（同じ収入・支出の中で）'),
        subcategory: name.optional().describe('新しいサブカテゴリ。空文字で消す'),
        paymentMethod: name.optional().describe('新しい支払方法（支出だけ）。空文字で消す'),
        description: memo.optional().describe('新しいメモ（200文字まで）。空文字で消す'),
      }),
      annotations: { title: '取引の編集の確認', ...PREVIEW },
    },
    async ({ id, ...changes }, ctx) =>
      runTool(
        'preview_update_transaction',
        ctx,
        (uid) => {
          requireWriteScope(ctx);
          return previewUpdateTransaction(uid, id, changes);
        },
        FAILURE_MESSAGE
      )
  );

  server.registerTool(
    'update_transaction',
    {
      title: '取引の編集',
      description:
        'preview_update_transaction で確認した編集を反映する。利用者が変更前と変更後を見て承認した後にだけ呼ぶ。' +
        '入力は確認トークンだけ。同じトークンで呼び直しても結果は変わらない（alreadyApplied が true になる）。' +
        '確認トークンの期限は30分。取引の削除はできない。',
      inputSchema: z.object({ confirmationToken: token.describe('preview_update_transaction が返した confirmationToken') }),
      annotations: {
        title: '取引の編集',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input, ctx) =>
      runTool(
        'update_transaction',
        ctx,
        (uid) => {
          requireWriteScope(ctx);
          return updateTransaction(uid, input.confirmationToken);
        },
        FAILURE_MESSAGE
      )
  );
};
