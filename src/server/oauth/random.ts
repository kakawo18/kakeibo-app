/**
 * 認可コード・リフレッシュトークンの値と、保存に使うハッシュ
 *
 * 値は32バイトの乱数。Firestore には値そのものではなくハッシュを ID として保存するので、
 * データベースの中身を見られてもコードやトークンとしては使えない（docs/claude-connector/仕様書.md 5.6）。
 */
import { createHash, randomBytes } from 'node:crypto';

export const randomToken = (): string => randomBytes(32).toString('base64url');

export const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');
