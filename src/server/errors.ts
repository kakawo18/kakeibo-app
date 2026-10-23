import 'server-only';

/**
 * 利用者（Claude の会話）に見せてよい説明つきのエラー
 *
 * ツールはこのエラーの message だけを返す。それ以外のエラーは中身を出さず、
 * 決まった文言にする（取引の中身や内部の事情を会話に出さない）。
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}
