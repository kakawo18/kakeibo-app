import dayjs from 'dayjs';

/** YYYY-MM-DD 形式にフォーマット（CSVエクスポート等） */
export const formatDate = (date: Date | string): string => {
  return dayjs(date).format('YYYY-MM-DD');
};

/** 現在の月を YYYY-MM 形式で返す */
export const getCurrentMonth = (): string => {
  return dayjs().format('YYYY-MM');
};

/** YYYY-MM 形式を「YYYY年MM月」表記に変換 */
export const getMonthName = (monthString: string): string => {
  return dayjs(monthString).format('YYYY年MM月');
};

/** 「2026年7月3日(金)」形式にフォーマット（フォームの日付表示用） */
export const formatDateJa = (date: Date): string => {
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
};

/** 月選択セレクト用の選択肢を生成（過去 yearsBack 年〜未来 yearsForward 年） */
export const getMonthOptions = (yearsBack: number = 2, yearsForward: number = 1): { value: string; label: string }[] => {
  const options: { value: string; label: string }[] = [];
  const today = dayjs();

  for (let i = -yearsBack * 12; i <= yearsForward * 12; i++) {
    const date = today.add(i, 'month');
    options.push({ value: date.format('YYYY-MM'), label: date.format('YYYY年MM月') });
  }

  return options;
};

/** YYYY-MM 形式の翌月を返す */
export const getNextMonth = (month: string): string => {
  return dayjs(month).add(1, 'month').format('YYYY-MM');
};

/** YYYY-MM 形式の前月を返す */
export const getPreviousMonthFromCurrent = (month: string): string => {
  return dayjs(month).subtract(1, 'month').format('YYYY-MM');
};

/** ローカルタイムゾーンで YYYY-MM 形式にフォーマット */
export const formatMonthLocal = (date: Date): string => {
  return dayjs(date).format('YYYY-MM');
};
