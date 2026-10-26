/**
 * ツールの共通処理: 利用者の特定・日本時間の確認・結果とエラーの形
 */
import 'server-only';
import type { CallToolResult, ServerContext } from '@modelcontextprotocol/server';
import { assertJapanTime } from '../timezone';
import { UserFacingError } from '../errors';

/**
 * トークンの検証結果（verifyMcpToken が extra.uid に入れた値）から uid を取り出す。
 * uid をツールの入力から受け取ることはしない（docs/claude-connector/仕様書.md 7.2）
 */
export const uidFrom = (ctx: ServerContext): string => {
  const uid = ctx.http?.authInfo?.extra?.uid;
  if (typeof uid !== 'string' || !uid) throw new Error('Authenticated uid is missing');
  return uid;
};

const text = (value: string): CallToolResult['content'] => [{ type: 'text', text: value }];

/**
 * ツールの処理を実行し、結果を JSON の文字列で返す
 *
 * UserFacingError はその説明を返す。それ以外のエラーは中身を会話に出さず、
 * ログにもツール名とエラーの種類・メッセージだけを出す（取引の中身は出さない）。
 */
export const runTool = async (
  name: string,
  ctx: ServerContext,
  build: (uid: string) => unknown | Promise<unknown>,
  failureMessage = '家計簿の読み出しに失敗しました。時間をおいてもう一度試してください。'
): Promise<CallToolResult> => {
  try {
    assertJapanTime();
    const result = await build(uidFrom(ctx));
    return { content: text(JSON.stringify(result)) };
  } catch (error) {
    if (error instanceof UserFacingError) {
      return { isError: true, content: text(error.message) };
    }
    console.error(`MCP tool ${name} failed:`, error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error');
    return { isError: true, content: text(failureMessage) };
  }
};

