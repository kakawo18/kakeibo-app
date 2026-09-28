/**
 * 取引の購読を「直近」と「過去」に分ける境界（#125）
 *
 * 起動時に全期間を読むと、端末キャッシュ（IndexedDB）への書き込みと読み出しが
 * 取引件数に比例して遅くなる。直近13か月（今月を含む）だけを常に購読し、
 * それより古い分は必要になったときに2本目の購読で読む。
 *
 * 13か月あれば、今年の年間 KPI（1月から）・前年同月との比較・今月の定期取引をまかなえる。
 */
import { Transaction } from '@/types';

/** 直近として常に購読する月数（今月を含む） */
export const RECENT_MONTHS = 13;

/**
 * 直近の購読の開始日時（この日時以降が直近、より前が過去）
 *
 * 今月を含めて RECENT_MONTHS か月前の月初 0:00（端末のローカル時刻）。
 */
export const recentWindowStart = (now: Date): Date =>
  new Date(now.getFullYear(), now.getMonth() - (RECENT_MONTHS - 1), 1);

/**
 * 直近と過去の取引を1つの配列にする（日付の新しい順）
 *
 * どちらも日付の新しい順で、直近はすべて境界以降・過去はすべて境界より前なので、
 * つなげるだけで全体も新しい順になる。期間が重ならないので重複もしない。
 */
export const mergeTransactionRanges = (
  recent: Transaction[],
  older: Transaction[]
): Transaction[] => (older.length === 0 ? recent : recent.length === 0 ? older : [...recent, ...older]);
