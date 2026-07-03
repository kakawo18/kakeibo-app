'use client';

import { useState } from 'react';
import { Button, Group, FileInput, Text, Alert, Modal, Stack } from '@mantine/core';
import { IconDownload, IconUpload, IconFileText } from '@tabler/icons-react';
import { useTransactions } from '@/contexts/TransactionsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { exportToCSV, parseCSV } from '@/utils/csvUtils';
import { notifications } from '@mantine/notifications';

interface CSVImportExportProps {
  opened: boolean;
  onClose: () => void;
}

export const CSVImportExport: React.FC<CSVImportExportProps> = ({ opened, onClose }) => {
  const { transactions, addTransaction } = useTransactions();
  const { rules } = useSettings();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

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

    setImporting(true);
    try {
      const text = await importFile.text();
      const parsedTransactions = parseCSV(text, rules);

      if (parsedTransactions.length === 0) {
        notifications.show({
          title: 'インポートエラー',
          message: '有効なデータが見つかりませんでした',
          color: 'red',
        });
        return;
      }

      // Import all transactions
      let importedCount = 0;
      for (const transaction of parsedTransactions) {
        try {
          await addTransaction(transaction);
          importedCount++;
        } catch (error) {
          console.error('Error importing transaction:', error);
        }
      }

      notifications.show({
        title: 'インポート完了',
        message: `${importedCount}件のデータをインポートしました`,
        color: 'green',
      });

      setImportFile(null);
      onClose();
    } catch {
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
              日付, 種別, カテゴリ, サブカテゴリ, 金額, メモ, 支払方法
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