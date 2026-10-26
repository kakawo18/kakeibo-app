/**
 * 二重登録の判定（docs/claude-connector/書き込み仕様書.md 5.7 節）
 *
 * 同じ日・同じ種類・同じ金額の取引を「同じものかもしれない」として返す。レシートを2回送る、
 * 同じ内容を2回頼む、という典型的な重複を、その日の取引を読むだけで見つけるため。
 * メモ（店名）は比べない。手で入力したメモとレシートから読んだ店名は表記が揺れ、比べると見逃しが増える。
 * 日付をずらして記録した重複は見つからないので、警告が無いことは重複が無いことを意味しない。
 */
import 'server-only';
import { Transaction, UserSettings } from '@/types';
import { createTransactionRules } from '@/domain/transactionRules';
import { formatDate } from '@/utils/dateUtils';
import { DraftWarning, TransactionDraft, toTransactionView } from './transactionDraft';

export const findPossibleDuplicates = (
  draft: Pick<TransactionDraft, 'date' | 'type' | 'amount'>,
  sameDayTransactions: Transaction[]
): Transaction[] =>
  sameDayTransactions.filter(
    (t) => formatDate(t.date) === draft.date && t.type === draft.type && t.amount === draft.amount
  );

export const duplicateWarnings = (duplicates: Transaction[], settings: UserSettings): DraftWarning[] => {
  if (duplicates.length === 0) return [];
  const rules = createTransactionRules(settings);
  return [
    {
      kind: 'possible_duplicate',
      message: '同じ日・同じ金額の取引がすでにあります。同じものを二重に記録しようとしていないか、利用者に確かめてください',
      transactions: duplicates.map((t) => toTransactionView(t, rules)),
    },
  ];
};
