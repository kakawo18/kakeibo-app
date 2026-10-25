/**
 * 認可コード・リフレッシュトークンの値と、保存に使うハッシュ
 *
 * 値は32バイトの乱数。Firestore には値そのものではなくハッシュを ID として保存するので、
 * データベースの中身を見られてもコードやトークンとしては使えない（docs/claude-connector/仕様書.md 5.6）。
 */
import { createHash, randomBytes } from 'node:crypto';

export const randomToken = (): string => randomBytes(32).toString('base64url');

/** randomToken の形（32バイトの base64url = パディングなしで43文字） */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * randomToken で作った値の形か。形が違えば Firestore を読まずに拒否する
 * （でたらめな値の連打で読み取りの無料枠を使わせない。#179）
 */
export const isTokenFormat = (value: string): boolean => TOKEN_PATTERN.test(value);

export const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');
