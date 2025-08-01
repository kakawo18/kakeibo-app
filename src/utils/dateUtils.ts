import dayjs from 'dayjs';

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
  
  const year = parseInt(dateString.substring(0, 4));
  const month = parseInt(dateString.substring(4, 6));
  const day = parseInt(dateString.substring(6, 8));
  
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  
  const date = new Date(year, month - 1, day);
  
  // 実際に作成された日付が入力と一致するかチェック
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  
  return date;
};

// Date型をYYYYMMDD形式の文字列に変換
export const formatToYYYYMMDD = (date: Date): string => {
  return dayjs(date).format('YYYYMMDD');
};

// 【新機能】ローカルタイムゾーンでの月フォーマット（タイムゾーン問題解決）
export const formatMonthLocal = (date: Date): string => {
  // ローカルタイムゾーンで年月を取得
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
};

// 【新機能】ローカルタイムゾーンでの日付文字列比較
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
};

// 【新機能】ローカルタイムゾーンでの月判定
export const isSameMonth = (date: Date, monthString: string): boolean => {
  const dateMonth = formatMonthLocal(date);
  return dateMonth === monthString;
};