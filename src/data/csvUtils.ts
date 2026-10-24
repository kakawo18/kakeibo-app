import { Transaction, TransactionInput, TransactionType } from '@/types';
import { formatDate } from '@/utils/dateUtils';
import { TransactionFlags, TransactionRules } from '@/domain/transactionRules';
import { MAX_AMOUNT, MAX_NAME_LENGTH } from '@/utils/validation';

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

/** CSV の1レコード（フィールド配列）と、それがファイル上の何行目から始まるか */
interface CSVRecord {
  fields: string[];
  line: number;
}

/**
 * CSV 全体をレコード単位に分解する（RFC 4180）
 *
 * 引用符の中の改行はフィールドの一部として残す。先に改行で行に割ってから
 * 1行ずつ解析すると、メモに改行があるレコードが途中で切れてしまうため（#102）。
 * 行番号はファイル上の物理行で数える（エラー報告で利用者が行を探せるように）。
 */
const parseCSVRecords = (text: string): CSVRecord[] => {
  const records: CSVRecord[] = [];
  let fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;

  const endRecord = () => {
    fields.push(current);
    records.push({ fields, line: recordStartLine });
    fields = [];
    current = '';
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          // エスケープされたダブルクォート
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === '\n') line++;
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else if (char === '\r' || char === '\n') {
      // CRLF は1つの改行として扱う
      if (char === '\r' && text[i + 1] === '\n') i++;
      endRecord();
      line++;
      recordStartLine = line;
    } else {
      current += char;
    }
  }

  // 末尾に改行が無いファイルの最後のレコード
  if (current !== '' || fields.length > 0) endRecord();

  // 空行（何も書かれていない・空白だけの行）は数えない
  return records.filter(
    (record) => record.fields.length > 1 || record.fields[0].trim() !== ''
  );
};

/** 旧形式（v6.4.x まで）からある7列 */
const BASE_HEADERS = ['日付', '種別', 'カテゴリ', 'サブカテゴリ', '金額', 'メモ', '支払方法'];

/**
 * 支出集計のフラグ列（#99）
 *
 * 集計から外れるかどうかは役割ではなく取引ごとの affectsExpense が決める。
 * 過去の「カード引き落とし」のように今の設定からは導出できない値があるので、
 * バックアップから戻したときに意味が変わらないよう、そのまま書き出す。
 */
const FLAG_HEADERS = ['取引タイプ', '支出に含める'];

const TRANSACTION_TYPES: readonly TransactionType[] = ['normal', 'card_payment', 'card_withdrawal'];

/** 取引を CSV の文字列にする（BOM は付けない） */
export const buildCSV = (transactions: Transaction[]): string =>
  [
    [...BASE_HEADERS, ...FLAG_HEADERS].join(','),
    ...transactions.map((transaction) =>
      [
        formatDate(transaction.date),
        transaction.type === 'income' ? '収入' : '支出',
        transaction.category,
        transaction.subcategory || '',
        transaction.amount,
        transaction.description || '',
        transaction.paymentMethod || '',
        transaction.transactionType ?? '',
        // 未設定の古いデータは支出に含める扱い（isExcludedFromExpense と同じ）
        transaction.affectsExpense === false ? '0' : '1',
      ]
        .map(escapeCSVField)
        .join(',')
    ),
  ].join('\n');

export const exportToCSV = (transactions: Transaction[]): void => {
  // サーバーサイドレンダリング時は何もしない
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.warn('CSV export is not available on server side');
    return;
  }

  const blob = new Blob(['\uFEFF' + buildCSV(transactions)], { type: 'text/csv;charset=utf-8;' });
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
  // BOM除去。改行は CRLF / LF のどちらでもよい
  const [header, ...allRecords] = parseCSVRecords(csvText.replace(/^\uFEFF/, ''));

  // フラグ列は、見出しがこのアプリの書き出した名前のときだけ読む。
  // 他のアプリの CSV に8列目以降があっても、それをフラグと取り違えないため
  const headerFields = header?.fields.map((field) => field.trim()) ?? [];
  const hasFlagColumns = FLAG_HEADERS.every(
    (name, index) => headerFields[BASE_HEADERS.length + index] === name
  );

  const truncated = allRecords.length > MAX_IMPORT_ROWS;
  const records = truncated ? allRecords.slice(0, MAX_IMPORT_ROWS) : allRecords;

  /**
   * 書き出したときの集計フラグを読む。フラグ列が無い旧形式の CSV や
   * 「支出に含める」が壊れている行では null を返し、支払方法から導出し直す。
   * 取引タイプだけが空・不正な行（取引タイプを持たない古いデータ）は、
   * 導出した取引タイプに「支出に含める」の値を組み合わせる
   */
  const readFlags = (fields: string[], derived: TransactionFlags): TransactionFlags | null => {
    if (!hasFlagColumns) return null;
    const affects = fields[BASE_HEADERS.length + 1]?.trim();
    if (affects !== '0' && affects !== '1') return null;
    const transactionType = fields[BASE_HEADERS.length]?.trim() as TransactionType;
    return {
      transactionType: TRANSACTION_TYPES.includes(transactionType)
        ? transactionType
        : derived.transactionType,
      affectsExpense: affects === '1',
    };
  };

  const transactions: TransactionInput[] = [];
  const skippedRows: { row: number; reason: string }[] = [];
  const unknownCategories = new Set<string>();
  const { knownCategories } = options;

  records.forEach((record) => {
    // ファイル上の行番号（改行入りのメモがあってもレコードの先頭行を指す）
    const row = record.line;
    // エクスポート時に付けた数式インジェクション対策の ' を戻す
    const fields = record.fields.map(unescapeFormulaGuard);

    const category = fields[2]?.trim();
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

    const subcategory = fields[3]?.trim() || undefined;
    const description = fields[5]?.trim().slice(0, MAX_DESCRIPTION_LENGTH) || undefined;
    const paymentMethod = fields[6]?.trim() || undefined;

    // 名前は切り詰めずにスキップする。切り詰めると設定のカテゴリと別の名前になり、
    // 役割も色も付かないまま取り込まれてしまう（#117）
    if ([category, subcategory, paymentMethod].some((name) => (name?.length ?? 0) > MAX_NAME_LENGTH)) {
      skippedRows.push({ row, reason: `名前が${MAX_NAME_LENGTH}文字を超えている` });
      return;
    }

    // 今の設定から導出した集計フラグ。旧形式の CSV ではこれをそのまま使う
    const derived = rules.deriveTransactionFlags(category, paymentMethod);

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
      ...(readFlags(fields, derived) ?? derived),
    });
  });

  return {
    transactions,
    skippedRows,
    truncated,
    unknownCategories: Array.from(unknownCategories),
  };
};
