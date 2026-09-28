/**
 * 未送信の変更があるかどうか（#110）
 *
 * 取引の購読で includeMetadataChanges を使うと、送信完了のたびに通知が来る代わりに
 * 初回の読み込みが重くなる（6,000件で約2秒）。代わりに waitForPendingWrites で
 * 「今ある未送信の変更が送り終わったか」を待つ。取引・定期取引・設定のどの書き込みも対象。
 */
import { useSyncExternalStore } from 'react';
import { waitForPendingWrites } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** これより早く送り終われば「未送信」を表示しない（オンライン時のちらつきを防ぐ） */
const SHOW_AFTER_MS = 500;

let pending = false;
let generation = 0;
const listeners = new Set<() => void>();

const setPending = (value: boolean) => {
  if (pending === value) return;
  pending = value;
  listeners.forEach((listener) => listener());
};

/**
 * 今ある未送信の変更が送り終わるまで「未送信あり」にする
 *
 * @param queued 書き込みが送信待ちになったと分かっているとき true（すぐ表示する）
 */
export const watchPendingWrites = (queued = false): void => {
  const current = ++generation;
  let flushed = false;
  if (queued) setPending(true);

  waitForPendingWrites(db)
    .then(() => {
      flushed = true;
      // 後から別の書き込みを待ち始めていたら、そちらに任せる
      if (current === generation) setPending(false);
    })
    .catch(() => {
      // ログアウト（Firestore の終了）などで待てなくなったときは表示を消す
      if (current === generation) setPending(false);
    });

  if (!queued) {
    setTimeout(() => {
      if (!flushed && current === generation) setPending(true);
    }, SHOW_AFTER_MS);
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** 未送信の変更があるか */
export const usePendingWrites = (): boolean =>
  useSyncExternalStore(subscribe, () => pending, () => false);
