/**
 * エミュレータのテストで使う、ログイン済みのクライアント
 *
 * firestore.rules はメールアドレスを確認済みのユーザーにしか家計データを読み書きさせない（#164）。
 * 通常の利用者として振る舞わせるテストはこちらを使う。未確認のユーザーは
 * env.authenticatedContext(uid) をそのまま使う（同じ uid で両方を作らないこと。インスタンスが使い回される）
 */
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { Firestore } from 'firebase/firestore';

export const verifiedFirestore = (env: RulesTestEnvironment, uid: string): Firestore =>
  env.authenticatedContext(uid, { email_verified: true }).firestore() as unknown as Firestore;
