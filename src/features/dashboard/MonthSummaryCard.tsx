'use client';

/**
 * ホームの収支バンド: 月の切り替え・今月の収支（ヒーロー数値）| 収入 | 支出（#124 で DashboardContent から分離）
 */
import { Stack, Grid, Text, Group, Box, Paper, UnstyledButton } from '@mantine/core';
import { IconArrowUpRight, IconArrowDownRight, IconMinus, IconChevronRight } from '@tabler/icons-react';
import { MonthNav } from '@/components/ui/MonthNav';
import { MonthlyData, Trend } from '@/types';
import { calculateMonthlyComparison } from '@/domain/calculations';

// ============================================================
// 前月比トレンド（色付きの矢印 + % のみ。バッジの面は使わない）
// ============================================================
const TrendIndicator = ({ trend, percentage }: { trend: Trend; percentage: number }) => {
  if (percentage === 0) return null;

  const color = trend === 'up' ? 'var(--income)' : trend === 'down' ? 'var(--expense)' : 'var(--ink-3)';
  const icon =
    trend === 'up' ? <IconArrowUpRight size={13} /> :
    trend === 'down' ? <IconArrowDownRight size={13} /> :
    <IconMinus size={13} />;

  return (
    <Group gap={3} align="center" style={{ color }}>
      {icon}
      <Text size="xs" fw={600} className="tabular-nums" style={{ color }}>
        {Math.abs(percentage)}%
      </Text>
      <Text size="xs" c="dimmed">前月比</Text>
    </Group>
  );
};

interface MonthSummaryCardProps {
  selectedMonthData: MonthlyData | undefined;
  /** 前月のデータが無い月は null（意味のない前月比を出さない） */
  monthlyComparison: ReturnType<typeof calculateMonthlyComparison> | null;
  onOpenAnnualReview: () => void;
  isMobile: boolean;
}

export const MonthSummaryCard = ({
  selectedMonthData,
  monthlyComparison,
  onOpenAnnualReview: openAnnualReview,
  isMobile,
}: MonthSummaryCardProps) => {
  const monthBalance = selectedMonthData?.net ?? 0;

  return (
      <Paper className="ledger-card" p={isMobile ? 'lg' : 'xl'}>
        {/* 月の切り替えはこの行に同居させる。専用の行を作ると高さだけを食うため。
            カード自体はクリック対象にしない（中に月移動のボタンがあるため） */}
        <Group justify="space-between" align="center" wrap="wrap" gap={8} style={{ rowGap: 0 }} mb={isMobile ? 'sm' : 'md'}>
          <MonthNav />
          <UnstyledButton
            onClick={openAnnualReview}
            aria-label="年間振り返りを開く"
            // 文字だけだと高さ17pxしかなく押しにくかった（#111）
            style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}
          >
            <Group gap={2} style={{ color: 'var(--ink-3)' }} wrap="nowrap">
              <Text size="xs" fw={600} style={{ color: 'inherit', whiteSpace: 'nowrap' }}>年間振り返り</Text>
              <IconChevronRight size={13} />
            </Group>
          </UnstyledButton>
        </Group>

        <Grid gutter={isMobile ? 'lg' : 'xl'} align="center">
          {/* ヒーロー: 今月の収支 */}
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Stack gap={8} align={isMobile ? 'center' : 'flex-start'}>
              <Text className="overline-label">収支</Text>
              <Text
                className="tabular-nums"
                style={{
                  fontSize: isMobile ? '2.375rem' : '2.75rem',
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: '-0.025em',
                  color: monthBalance >= 0 ? 'var(--income)' : 'var(--expense)',
                }}
              >
                {monthBalance >= 0 ? '+' : '-'}
                <span className="amount-symbol">¥</span>
                {Math.abs(monthBalance).toLocaleString()}
              </Text>
              {monthlyComparison && (
                <TrendIndicator
                  trend={monthlyComparison.net.trend}
                  percentage={monthlyComparison.net.percentage}
                />
              )}
          </Stack>
        </Grid.Col>

        {/* 収入・支出 */}
        <Grid.Col span={{ base: 6, sm: 3 }}>
          <Stack
            gap={6}
            pl={isMobile ? 0 : 'lg'}
            style={isMobile ? undefined : { borderLeft: '1px solid var(--hairline)' }}
          >
            <Group gap={6}>
              <Box w={7} h={7} style={{ borderRadius: '50%', background: 'var(--income)' }} />
              <Text className="overline-label">収入</Text>
            </Group>
            <Text fw={700} className="tabular-nums" style={{ fontSize: 19, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
              <span className="amount-symbol">¥</span>
              {(selectedMonthData?.income || 0).toLocaleString()}
            </Text>
            {monthlyComparison && (
              <Text size="xs" c="dimmed" className="tabular-nums">
                前月比 {monthlyComparison.income.trend === 'up' ? '+' : ''}{monthlyComparison.income.percentage}%
              </Text>
            )}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 6, sm: 3 }}>
          <Stack
            gap={6}
            pl={isMobile ? 0 : 'lg'}
            style={isMobile ? undefined : { borderLeft: '1px solid var(--hairline)' }}
          >
            <Group gap={6}>
              <Box w={7} h={7} style={{ borderRadius: '50%', background: 'var(--expense)' }} />
              <Text className="overline-label">支出</Text>
            </Group>
            <Text fw={700} className="tabular-nums" style={{ fontSize: 19, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
              <span className="amount-symbol">¥</span>
              {(selectedMonthData?.expense || 0).toLocaleString()}
            </Text>
            {monthlyComparison && (
              <Text size="xs" c="dimmed" className="tabular-nums">
                前月比 {monthlyComparison.expense.trend === 'up' ? '+' : ''}{monthlyComparison.expense.percentage}%
              </Text>
            )}
          </Stack>
        </Grid.Col>
      </Grid>
    </Paper>
  );
};
