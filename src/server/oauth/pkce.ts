/**
 * PKCE（RFC 7636）の照合。S256 だけを受け付ける
 *
 * Claude は認可の最初に code_verifier（秘密の値）のハッシュ code_challenge を送り、
 * トークンと交換するときに code_verifier そのものを送る。認可コードを横取りされても、
 * code_verifier を知らなければ交換できない。
 */
import { createHash, timingSafeEqual } from 'node:crypto';

const VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;
/** S256 の code_challenge は sha256 の base64url（パディングなし）で43文字 */
export const CHALLENGE_PATTERN = /^[A-Za-z0-9\-_]{43}$/;

export const challengeOf = (verifier: string): string =>
  createHash('sha256').update(verifier).digest('base64url');

export const verifyPkce = (verifier: string, challenge: string): boolean => {
  if (!VERIFIER_PATTERN.test(verifier) || !CHALLENGE_PATTERN.test(challenge)) return false;
  const computed = Buffer.from(challengeOf(verifier));
  const expected = Buffer.from(challenge);
  return computed.length === expected.length && timingSafeEqual(computed, expected);
};
