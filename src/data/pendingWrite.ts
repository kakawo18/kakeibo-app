/**
 * オフラインでの書き込みの扱い（#126 / #110）
 *
 * Firestore の書き込み（addDoc / setDoc / updateDoc / deleteDoc）は、端末のキャッシュに
 * すぐ反映されるが、Promise はサーバーが受け取るまで解決しない。オフラインで await すると
 * 保存ボタンが回り続け、画面が閉じられなかった。
 *
 * オフライン（または一定時間サーバーから返事が無い）ときは、端末に保存した時点で
 * 「送信待ち」として返す。書き込み自体は SDK が保持し、通信が戻ると自動で送信する。
 * 送信待ちにした後で失敗したとき（権限エラーなど）は onLateError で知らせる。
 */

/** saved = サーバーまで保存済み / queued = 端末に保存し、通信が戻ったら送信する */
export type WriteResult = 'saved' | 'queued';

/** オンラインでもこの時間サーバーから返事が無ければ送信待ちとして扱う（電波の弱い場所など） */
export const SERVER_ACK_TIMEOUT_MS = 4000;

interface SettleOptions {
  /** 今オンラインか（テストで差し替えられるよう引数にする） */
  isOnline?: () => boolean;
  timeoutMs?: number;
  /** 送信待ちとして返した後に書き込みが失敗したとき */
  onLateError?: (error: unknown) => void;
}

const browserIsOnline = (): boolean =>
  typeof navigator === 'undefined' || navigator.onLine !== false;

export const settleWrite = (
  write: Promise<unknown>,
  { isOnline = browserIsOnline, timeoutMs = SERVER_ACK_TIMEOUT_MS, onLateError }: SettleOptions = {}
): Promise<WriteResult> =>
  new Promise<WriteResult>((resolve, reject) => {
    let settled = false;

    const queue = () => {
      if (settled) return;
      settled = true;
      resolve('queued');
    };
    // オフラインならすぐ、オンラインでも返事が無ければ一定時間で送信待ちにする
    const online = isOnline();
    const timer = online ? setTimeout(queue, timeoutMs) : undefined;

    write.then(
      () => {
        if (timer) clearTimeout(timer);
        if (settled) return;
        settled = true;
        resolve('saved');
      },
      (error) => {
        if (timer) clearTimeout(timer);
        if (settled) {
          onLateError?.(error);
          return;
        }
        settled = true;
        reject(error);
      }
    );

    if (!online) queue();
  });
