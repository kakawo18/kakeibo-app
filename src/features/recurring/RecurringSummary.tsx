'use client';

/**
 * 毎月の定期取引の合計と内訳
 *
 * - RecurringSummaryCard: ホームに置く小さなカード。押すと設定タブの内訳へ移る
 * - RecurringSummarySection: 設定タブの上部。合計・支出/投資の内訳・カテゴリごとの一覧と管理画面への導線
 *
 * 合計は有効な定期取引だけ（1か月分）。集計は src/domain/recurring.ts の summarizeRecurring。
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  useComputedColorScheme,
} from '@mantine/core';
import { IconChevronRight, IconRepeat } from '@tabler/icons-react';
import { useRecurringTransactions } from '@/contexts/RecurringTransactionsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { pressable } from '@/components/ui/pressable';
import { RecurringSummary, summarizeRecurring } from '@/domain/recurring';
import { RecurringTransactionManager } from './RecurringTransactionManager';

const yen = (amount: number) => `¥${amount.toLocaleString()}`;

const useRecurringSummary = () => {
  const { recurringTransactions, loading, error } = useRecurringTransactions();
  const { rules } = useSettings();
  const summary = useMemo(
    () => summarizeRecurring(recurringTransactions, rules),
    [recurringTransactions, rules]
  );
  return { summary, loading, error };
};

/**
 * 支出・投資・立替などの内訳（0円の区分は出さない）
 * すべて支出のときは合計と同じ額になるだけなので、何も出さない
 */
const roleParts = (summary: RecurringSummary) => {
  if (summary.expense === summary.total) return [];
  return [
    { label: '支出', amount: summary.expense },
    { label: '投資', amount: summary.investment },
    { label: '立替など', amount: summary.other },
  ].filter((part) => part.amount > 0);
};

// ============================================================
// ホームのカード
// ============================================================
export const RecurringSummaryCard = () => {
  const { summary, loading, error } = useRecurringSummary();
  const router = useRouter();

  // 読み込み中・失敗・未登録のときはホームに出さない（設定タブで案内する）
  if (loading || error || summary.count === 0) return null;
  const parts = roleParts(summary);

  return (
    <Paper
      className="ledger-card ledger-card-clickable"
      p="md"
      {...pressable(() => router.push('/settings'), '定期取引の内訳を開く')}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs" mb={6}>
        <Group gap={6} c="var(--ink-3)" wrap="nowrap">
          <IconRepeat size={14} stroke={1.8} />
          <Text className="overline-label">毎月の定期取引</Text>
        </Group>
        <Group gap={2} c="var(--ink-3)" wrap="nowrap">
          <Text size="xs" c="dimmed">{summary.count}件</Text>
          <IconChevronRight size={14} stroke={1.8} />
        </Group>
      </Group>
      <Text
        fw={700}
        className="tabular-nums"
        style={{ fontSize: 20, lineHeight: 1.1, letterSpacing: '-0.015em' }}
      >
        {yen(summary.total)}
      </Text>
      {parts.length > 0 && (
        <Text size="xs" c="dimmed" mt={6} className="tabular-nums">
          {parts.map((part) => `${part.label} ${yen(part.amount)}`).join(' · ')}
        </Text>
      )}
    </Paper>
  );
};

// ============================================================
// 設定タブのセクション
// ============================================================
export const RecurringSummarySection = () => {
  const { summary, loading, error } = useRecurringSummary();
  const { getColor } = useSettings();
  const isDark = useComputedColorScheme('light', { getInitialValueInEffect: true }) === 'dark';
  const [managerOpened, setManagerOpened] = useState(false);

  const renderBody = () => {
    if (error) {
      // 取得に失敗したときは「登録されていません」と区別する（#105）
      return (
        <Text size="sm" c="red" role="alert">
          定期取引を読み込めませんでした。通信状態を確認して、画面を開き直してください。
        </Text>
      );
    }
    if (loading) return <Text size="sm" c="dimmed">読み込み中...</Text>;
    if (summary.count === 0) {
      return (
        <Text size="sm" c="dimmed">
          {summary.disabledCount > 0
            ? `有効な定期取引がありません（無効 ${summary.disabledCount}件）`
            : '定期取引が登録されていません'}
        </Text>
      );
    }

    const parts = roleParts(summary);
    return (
      <Stack gap="md">
        {/* 合計 */}
        <Box>
          <Text className="overline-label" mb={4}>毎月の合計（{summary.count}件）</Text>
          <Text
            fw={700}
            className="tabular-nums"
            style={{ fontSize: 24, lineHeight: 1.1, letterSpacing: '-0.015em' }}
          >
            {yen(summary.total)}
          </Text>
        </Box>

        {/* 支出・投資の内訳 */}
        {parts.length > 0 && (
          <SimpleGrid cols={parts.length} spacing="xs">
            {parts.map((part) => (
              <Box key={part.label} style={{ minWidth: 0 }}>
                <Text className="overline-label" truncate>{part.label}</Text>
                <Text size="sm" fw={600} className="tabular-nums" truncate>
                  {yen(part.amount)}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        )}

        {/* カテゴリごとの内訳 */}
        <Stack gap={0}>
          {summary.byCategory.map((group) => (
            <Box key={group.category} py={10} style={{ borderTop: '1px solid var(--hairline)' }}>
              <Group justify="space-between" wrap="nowrap" mb={4}>
                <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                  <Box
                    w={8}
                    h={8}
                    style={{
                      borderRadius: '50%',
                      flexShrink: 0,
                      backgroundColor: getColor(group.category, isDark),
                    }}
                  />
                  <Text size="sm" fw={600} truncate>{group.category}</Text>
                </Group>
                <Text size="sm" fw={600} className="tabular-nums" style={{ flexShrink: 0 }}>
                  {yen(group.total)}
                </Text>
              </Group>
              {group.items.map((item) => (
                <Group key={item.id} justify="space-between" wrap="nowrap" pl={16} py={2}>
                  <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                    <Text size="xs" c="var(--ink-2)" truncate>{item.name}</Text>
                    <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                      毎月{item.dayOfMonth}日
                    </Text>
                  </Group>
                  <Text size="xs" c="var(--ink-2)" className="tabular-nums" style={{ flexShrink: 0 }}>
                    {yen(item.amount)}
                  </Text>
                </Group>
              ))}
            </Box>
          ))}
        </Stack>

        {summary.disabledCount > 0 && (
          <Text size="xs" c="dimmed">
            無効にしている定期取引（{summary.disabledCount}件）は合計に含めていません
          </Text>
        )}
      </Stack>
    );
  };

  return (
    <Paper className="ledger-card" p="lg">
      <Group justify="space-between" align="flex-start" wrap="nowrap" mb="md">
        <div>
          <Text className="section-title" mb={4}>定期取引</Text>
          <Text size="xs" c="dimmed">
            家賃やサブスクなど毎月決まった取引を登録します。実行日になるとホームに表示され、確認して記録します
          </Text>
        </div>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconRepeat size={14} />}
          onClick={() => setManagerOpened(true)}
          style={{ flexShrink: 0 }}
        >
          管理
        </Button>
      </Group>

      {renderBody()}

      <RecurringTransactionManager
        opened={managerOpened}
        onClose={() => setManagerOpened(false)}
      />
    </Paper>
  );
};
