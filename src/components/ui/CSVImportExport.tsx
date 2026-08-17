'use client';

import { useMemo, useState } from 'react';
import { Button, Group, FileInput, Text, Alert, Modal, Stack } from '@mantine/core';
import { IconDownload, IconUpload, IconFileText } from '@tabler/icons-react';
import { useTransactions } from '@/contexts/TransactionsContext';
import { useSettings } from '@/contexts/SettingsContext';
import {
  exportToCSV,
  parseCSV,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
} from '@/utils/csvUtils';
import { notifications } from '@mantine/notifications';

interface CSVImportExportProps {
  opened: boolean;
  onClose: () => void;
}

export const CSVImportExport: React.FC<CSVImportExportProps> = ({ opened, onClose }) => {
  const { transactions, addTransactions } = useTransactions();
  const { rules, settings } = useSettings();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // 設定に登録済みのカテゴリ/サブカテゴリ名（未登録カテゴリの警告用）
  const knownCategories = useMemo(() => {
    const names = new Set<string>();
    for (const category of settings?.categories ?? []) {
      names.add(category.name);
      for (const sub of category.subcategories) names.add(sub.name);
    }
    return names;
  }, [settings]);

  const handleExport = () => {
    if (transactions.length === 0) {
      notifications.show({
        title: 'エクスポートエラー',
        message: 'エクスポートするデータがありません',
        color: 'red',
      });
      return;
    }

    exportToCSV(transactions);
    notifications.show({
      title: 'エクスポート完了',
      message: 'CSVファイルをダウンロードしました',
      color: 'green',
    });
  };

  const handleImport = async () => {
    if (!importFile) return;

    // 巨大なファイルを読み込む前に弾く（読み込み自体でブラウザが固まるため）
    if (importFile.size > MAX_IMPORT_FILE_BYTES) {
      notifications.show({
        title: 'インポートエラー',
        message: `ファイルが大きすぎます（上限 ${Math.floor(MAX_IMPORT_FILE_BYTES / 1024 / 1024)}MB）`,
        color: 'red',
      });
      return;
    }

    setImporting(true);
    try {
      const text = await importFile.text();
      const result = parseCSV(text, rules, { knownCategories });

      if (result.transactions.length === 0) {
        notifications.show({
          title: 'インポートエラー',
          message: '有効なデータが見つかりませんでした',
          color: 'red',
        });
        return;
      }

      const importedCount = await addTransactions(result.transactions);

      // 結果の内訳（スキップ・打ち切り・未登録カテゴリ）を伝える
      const notes: string[] = [];
      if (result.skippedRows.length > 0) {
        const reasons = new Map<string, number>();
        result.skippedRows.forEach(({ reason }) =>
          reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
        );
        const breakdown = Array.from(reasons.entries())
          .map(([reason, count]) => `${reason}: ${count}件`)
          .join(' / ');
        notes.push(`${result.skippedRows.length}件をスキップしました（${breakdown}）`);
      }
      if (result.truncated) {
        notes.push(`上限の${MAX_IMPORT_ROWS}行までを取り込みました`);
      }
      if (result.unknownCategories.length > 0) {
        notes.push(`設定に無いカテゴリ: ${result.unknownCategories.join('、')}`);
      }

      notifications.show({
        title: 'インポート完了',
        message: [`${importedCount}件のデータをインポートしました`, ...notes].join('\n'),
        color: notes.length > 0 ? 'yellow' : 'green',
        autoClose: notes.length > 0 ? 10000 : undefined,
      });

      setImportFile(null);
      onClose();
    } catch (error) {
      console.error('Error importing CSV:', error);
      notifications.show({
        title: 'インポートエラー',
        message: 'ファイルの読み込みに失敗しました',
        color: 'red',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="CSV インポート/エクスポート" size="md">
      <Stack>
        <div>
          <Text size="lg" fw={600} mb="sm">エクスポート</Text>
          <Text size="sm" c="dimmed" mb="md">
            すべての取引データをCSVファイルでダウンロードします
          </Text>
          <Button
            leftSection={<IconDownload size={16} />}
            onClick={handleExport}
            disabled={transactions.length === 0}
          >
            CSVでエクスポート ({transactions.length}件)
          </Button>
        </div>

        <div>
          <Text size="lg" fw={600} mb="sm">インポート</Text>
          <Text size="sm" c="dimmed" mb="md">
            CSVファイルから取引データをインポートします
          </Text>
          
          <Alert color="blue" mb="md">
            <Text size="sm">
              CSVファイルは以下の形式である必要があります：<br />
              日付, 種別, カテゴリ, サブカテゴリ, 金額, メモ, 支払方法<br />
              （上限: {Math.floor(MAX_IMPORT_FILE_BYTES / 1024 / 1024)}MB / {MAX_IMPORT_ROWS}行）
            </Text>
          </Alert>

          <FileInput
            label="CSVファイルを選択"
            placeholder="ファイルを選択してください"
            accept=".csv"
            value={importFile}
            onChange={setImportFile}
            leftSection={<IconFileText size={16} />}
            mb="md"
          />

          <Group justify="flex-end">
            <Button variant="light" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={handleImport}
              disabled={!importFile}
              loading={importing}
            >
              インポート
            </Button>
          </Group>
        </div>
      </Stack>
    </Modal>
  );
};