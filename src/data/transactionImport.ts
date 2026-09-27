/**
 * 取引の一括書き込み（CSV インポート用）（#103）
 *
 * Firestore の writeBatch は1回500件までなので分けて書く。途中のバッチが失敗すると
 * それまでのバッチは確定したまま残るため、
 * - 各行のドキュメント ID を「ファイルの内容のハッシュ + 行の位置」から決める。
 *   同じファイルをもう一度取り込むと、保存済みの行は同じ ID に上書きされるだけで
 *   重複しない（正当な同額・同日の取引は行の位置が違うので別の ID になる）
 * - 失敗したときは、そこまでに保存できた件数を ImportWriteError で返す
 */
import { Firestore, Timestamp, collection, doc, writeBatch } from 'firebase/firestore';
import { TransactionInput } from '@/types';
import { toTransactionCreateData } from '@/data/transactionSerializer';

/** writeBatch の上限（Firestore の制約） */
export const WRITE_BATCH_LIMIT = 500;

/** 途中のバッチで失敗した。written 件はすでに保存されている */
export class ImportWriteError extends Error {
  constructor(
    readonly written: number,
    readonly total: number,
    readonly cause: unknown
  ) {
    super(`Import failed after ${written} of ${total} transactions`);
    this.name = 'ImportWriteError';
  }
}

/** 取り込み単位の ID（ファイル内容の SHA-256 の先頭16桁） */
export const importIdFromText = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
};

/** 取り込んだ行のドキュメント ID */
export const importedTransactionId = (importId: string, index: number): string =>
  `csv-${importId}-${index}`;

export const writeTransactionsInBatches = async (
  db: Firestore,
  userId: string,
  inputs: TransactionInput[],
  options: { importId?: string; batchSize?: number } = {}
): Promise<number> => {
  const batchSize = options.batchSize ?? WRITE_BATCH_LIMIT;
  const now = Timestamp.fromDate(new Date());
  let written = 0;

  for (let start = 0; start < inputs.length; start += batchSize) {
    const chunk = inputs.slice(start, start + batchSize);
    const batch = writeBatch(db);

    chunk.forEach((input, offset) => {
      const ref = options.importId
        ? doc(db, 'transactions', importedTransactionId(options.importId, start + offset))
        : doc(collection(db, 'transactions'));
      batch.set(ref, {
        ...toTransactionCreateData(input),
        userId,
        createdAt: now,
        updatedAt: now,
      });
    });

    try {
      await batch.commit();
    } catch (error) {
      throw new ImportWriteError(written, inputs.length, error);
    }
    written += chunk.length;
  }

  return written;
};
