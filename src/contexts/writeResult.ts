/**
 * 書き込みの完了の待ち方をアプリ全体でそろえる（#126）
 *
 * オフラインのときはサーバーの確定を待たずに返し（送信待ち）、あとで失敗したら通知する。
 * 詳細は src/data/pendingWrite.ts。
 */
import { notifications } from '@mantine/notifications';
import { WriteResult, settleWrite } from '@/data/pendingWrite';

const notifyLateWriteError = (error: unknown) => {
  // 取引の中身は出さない。エラー（コード・メッセージ）だけ
  console.error('Queued write failed:', error);
  notifications.show({
    title: '保存できませんでした',
    message: '通信が戻った後の送信に失敗しました。内容を確認して、もう一度保存してください。',
    color: 'red',
    autoClose: false,
  });
};

export const settle = (write: Promise<unknown>): Promise<WriteResult> =>
  settleWrite(write, { onLateError: notifyLateWriteError });

/** 保存完了の通知。送信待ちならその旨を出す */
export const notifySaved = (result: WriteResult, message: string) => {
  notifications.show(
    result === 'saved'
      ? { title: '成功', message, color: 'green' }
      : {
          title: '端末に保存しました',
          message: `${message}。通信が戻ると自動で送信します`,
          color: 'blue',
        }
  );
};
