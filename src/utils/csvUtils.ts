import { Transaction, TransactionInput } from '@/types';
import { formatDate } from './dateUtils';
import { TransactionRules } from './transactionRules';

// Excel/スプレッドシートが数式として解釈してしまう先頭文字
// （クォートしても評価されるため、別途無害化が必要）
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

// CSVフィールドのエスケープ（RFC 4180: ダブルクォートは二重化する）
// あわせて数式インジェクション対策として、危険な先頭文字の前に ' を挿入する
const escapeCSVField = (field: string | number): string => {
  const str = String(field);
  const safe = FORMULA_PREFIX.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
};

// エクスポート時に付けた数式インジェクション対策の ' を取り除く
// （エクスポート → インポートの往復で値が変わらないようにする）
const unescapeFormulaGuard = (value: string): string =>
  value.startsWith("'") && FORMULA_PREFIX.test(value.slice(1)) ? value.slice(1) : value;

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

// ============================================================
// インポートの上限値
// 巨大なファイルでブラウザが固まったり、Firestore への書き込みが
// 際限なく走ったりしないよう、取り込み側で明確に打ち切る。
// ============================================================

/** 受け付けるファイルサイズの上限（2MB） */
export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;
/** 一度に取り込む行数の上限 */
export const MAX_IMPORT_ROWS = 5000;
/** メモの最大文字数（超過分は切り詰める） */
const MAX_DESCRIPTION_LENGTH = 200;
/** カテゴリ・サブカテゴリ・支払方法の最大文字数 */
const MAX_NAME_LENGTH = 50;
/** 1件あたりの金額の上限（桁の打ち間違い・不正値の検出用） */
const MAX_AMOUNT = 1_000_000_000;
/** 受け付ける日付の範囲 */
const MIN_DATE = new Date('1970-01-01').getTime();
const MAX_DATE = new Date('2100-12-31').getTime();

export interface CSVParseResult {
  /** 取り込み対象として有効だった行 */
  transactions: TransactionInput[];
  /** 取り込めなかった行（CSV の行番号と理由） */
  skippedRows: { row: number; reason: string }[];
  /** 行数上限で打ち切ったか */
  truncated: boolean;
  /** 取り込んだが、現在の設定に存在しないカテゴリ名（重複なし） */
  unknownCategories: string[];
}

interface ParseOptions {
  /** 設定に登録済みのカテゴリ/サブカテゴリ名。渡すと未登録カテゴリを警告として返す */
  knownCategories?: Set<string>;
}

export const parseCSV = (
  csvText: string,
  rules: TransactionRules,
  options: ParseOptions = {}
): CSVParseResult => {
  // BOM除去 + CRLF対応
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());

  // Skip header row
  const allDataLines = lines.slice(1);
  const truncated = allDataLines.length > MAX_IMPORT_ROWS;
  const dataLines = truncated ? allDataLines.slice(0, MAX_IMPORT_ROWS) : allDataLines;

  const transactions: TransactionInput[] = [];
  const skippedRows: { row: number; reason: string }[] = [];
  const unknownCategories = new Set<string>();
  const { knownCategories } = options;

  dataLines.forEach((line, index) => {
    // ヘッダー行 + 0始まりの index → ファイル上の行番号
    const row = index + 2;
    // エクスポート時に付けた数式インジェクション対策の ' を戻す
    const fields = parseCSVLine(line).map(unescapeFormulaGuard);

    const category = fields[2]?.trim().slice(0, MAX_NAME_LENGTH);
    if (!category) {
      skippedRows.push({ row, reason: 'カテゴリが空' });
      return;
    }

    const date = new Date(fields[0]);
    const time = date.getTime();
    if (Number.isNaN(time) || time < MIN_DATE || time > MAX_DATE) {
      skippedRows.push({ row, reason: '日付が不正' });
      return;
    }

    const amount = Number(fields[4]);
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      skippedRows.push({ row, reason: '金額が不正' });
      return;
    }

    const type = fields[1]?.trim();
    if (type !== '収入' && type !== '支出') {
      skippedRows.push({ row, reason: '種別が「収入」「支出」以外' });
      return;
    }

    const subcategory = fields[3]?.trim().slice(0, MAX_NAME_LENGTH) || undefined;
    const description = fields[5]?.trim().slice(0, MAX_DESCRIPTION_LENGTH) || undefined;
    const paymentMethod = fields[6]?.trim().slice(0, MAX_NAME_LENGTH) || undefined;

    // 設定に無いカテゴリも取り込むが、役割ベースの集計から漏れるため警告として返す
    if (knownCategories?.size && !knownCategories.has(category)) {
      unknownCategories.add(category);
    }

    transactions.push({
      date,
      type: type === '収入' ? 'income' : 'expense',
      category,
      subcategory,
      amount,
      description,
      paymentMethod,
      // カード支払い・引き落としの集計フラグを再導出する
      // （エクスポート→インポートで支出の二重計上が起きないようにする）
      ...rules.deriveTransactionFlags(category, paymentMethod),
    });
  });

  return {
    transactions,
    skippedRows,
    truncated,
    unknownCategories: Array.from(unknownCategories),
  };
};
