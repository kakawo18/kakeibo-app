import { Transaction, TransactionInput } from '@/types';
import { formatDate } from './dateUtils';
import { deriveTransactionFlags } from './transactionRules';

// CSVフィールドのエスケープ（RFC 4180: ダブルクォートは二重化する）
const escapeCSVField = (field: string | number): string => {
  const str = String(field);
  return `"${str.replace(/"/g, '""')}"`;
};

// クォート・カンマ・改行を考慮した1行分のCSVパース
const parseCSVLine = (line: string): string[] => {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          // エスケープされたダブルクォート
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);

  return fields;
};

export const exportToCSV = (transactions: Transaction[]): void => {
  // サーバーサイドレンダリング時は何もしない
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.warn('CSV export is not available on server side');
    return;
  }

  const headers = ['日付', '種別', 'カテゴリ', 'サブカテゴリ', '金額', 'メモ', '支払方法'];

  const csvContent = [
    headers.join(','),
    ...transactions.map(transaction => [
      formatDate(transaction.date),
      transaction.type === 'income' ? '収入' : '支出',
      transaction.category,
      transaction.subcategory || '',
      transaction.amount,
      transaction.description || '',
      transaction.paymentMethod || '',
    ].map(escapeCSVField).join(','))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `家計簿_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const parseCSV = (csvText: string): TransactionInput[] => {
  // BOM除去 + CRLF対応
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());

  // Skip header row
  const dataLines = lines.slice(1);

  return dataLines.map((line): TransactionInput => {
    const fields = parseCSVLine(line);
    const category = fields[2];
    const paymentMethod = fields[6] || undefined;

    return {
      date: new Date(fields[0]),
      type: fields[1] === '収入' ? 'income' : 'expense',
      category,
      subcategory: fields[3] || undefined,
      amount: parseInt(fields[4], 10),
      description: fields[5] || undefined,
      paymentMethod,
      // カード支払い・引き落としの集計フラグを再導出する
      // （エクスポート→インポートで支出の二重計上が起きないようにする）
      ...deriveTransactionFlags(category, paymentMethod),
    };
  }).filter(transaction =>
    !isNaN(transaction.date.getTime()) &&
    Number.isFinite(transaction.amount) &&
    transaction.amount > 0 &&
    transaction.category
  );
};
