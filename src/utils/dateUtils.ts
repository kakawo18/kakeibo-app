import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export const formatDate = (date: Date | string): string => {
  return dayjs(date).format('YYYY-MM-DD');
};

export const formatMonth = (date: Date | string): string => {
  return dayjs(date).format('YYYY-MM');
};

export const getCurrentMonth = (): string => {
  return dayjs().format('YYYY-MM');
};

export const getPreviousMonth = (): string => {
  return dayjs().subtract(1, 'month').format('YYYY-MM');
};

export const getMonthName = (monthString: string): string => {
  return dayjs(monthString).format('YYYY年MM月');
};

export const isCurrentMonth = (date: Date | string): boolean => {
  return dayjs(date).format('YYYY-MM') === getCurrentMonth();
};

// 月選択用のユーティリティ関数
export const getMonthOptions = (yearsBack: number = 2, yearsForward: number = 1): { value: string; label: string }[] => {
  const options: { value: string; label: string }[] = [];
  const today = dayjs();

  for (let i = -yearsBack * 12; i <= yearsForward * 12; i++) {
    const date = today.add(i, 'month');
    const value = date.format('YYYY-MM');
    const label = date.format('YYYY年MM月');
    options.push({ value, label });
  }

  return options;
};

export const getNextMonth = (month: string): string => {
  return dayjs(month).add(1, 'month').format('YYYY-MM');
};

export const getPreviousMonthFromCurrent = (month: string): string => {
  return dayjs(month).subtract(1, 'month').format('YYYY-MM');
};

// YYYYMMDD形式の文字列をDate型に変換
export const parseYYYYMMDD = (dateString: string): Date | null => {
  if (dateString.length !== 8) return null;

  const parsed = dayjs(dateString, 'YYYYMMDD');

  if (!parsed.isValid()) return null;

  // 入力値と一致するかチェック（2月30日等の無効な日付を検出）
  if (parsed.format('YYYYMMDD') !== dateString) return null;

  const year = parsed.year();
  if (year < 1900 || year > 2100) return null;

  return parsed.toDate();
};

// Date型をYYYYMMDD形式の文字列に変換
export const formatToYYYYMMDD = (date: Date): string => {
  return dayjs(date).format('YYYYMMDD');
};

// ローカルタイムゾーンでの月フォーマット
export const formatMonthLocal = (date: Date): string => {
  return dayjs(date).format('YYYY-MM');
};
