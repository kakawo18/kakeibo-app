'use client';

import { Box, Group, Paper, Stack, Text } from '@mantine/core';
import { CategoryYoY } from '@/utils/annualSummary';

interface CategoryYoYRankingProps {
  year: number;
  entries: CategoryYoY[];
  /** 前年の取引が1件でもあるか。無ければ比較自体が成り立たない */
  hasPreviousYear: boolean;
}

/** 一度に表示する件数 */
const DISPLAY_LIMIT = 10;

/**
 * カテゴリ別 年間支出の前年比
 *
 * 増減額の大きい順に、中央のゼロ軸から左右に振り分けて表示する。
 * 増えた側を支出色、減った側を収入色にして「効いた節約」が読めるようにする。
 */
export const CategoryYoYRanking: React.FC<CategoryYoYRankingProps> = ({
  year,
  entries,
  hasPreviousYear,
}) => {
  const displayed = entries.slice(0, DISPLAY_LIMIT);
  const maxDiff = Math.max(...displayed.map((entry) => Math.abs(entry.diff)), 1);

  return (
    <Paper className="ledger-card" p="lg">
      <Stack gap={2} mb="md">
        <Text className="section-title">{year}年 カテゴリ別支出の前年比</Text>
        <Text size="xs" c="dimmed">{year - 1}年との差が大きい順</Text>
      </Stack>

      {!hasPreviousYear ? (
        <Text ta="center" c="dimmed" py="xl" size="sm">
          比較対象の{year - 1}年のデータがありません
        </Text>
      ) : displayed.length === 0 ? (
        <Text ta="center" c="dimmed" py="xl" size="sm">データがありません</Text>
      ) : (
        <Stack gap={10}>
          {displayed.map((entry) => {
            const increased = entry.diff > 0;
            const color = increased ? 'var(--expense)' : 'var(--income)';
            const widthPercent = (Math.abs(entry.diff) / maxDiff) * 50;

            return (
              <Box key={entry.name}>
                <Group justify="space-between" wrap="nowrap" mb={4}>
                  <Text size="sm" lineClamp={1}>{entry.name}</Text>
                  <Group gap={8} wrap="nowrap">
                    {entry.rate !== null && (
                      <Text size="xs" c="dimmed" className="tabular-nums">
                        {increased ? '+' : ''}{entry.rate.toFixed(0)}%
                      </Text>
                    )}
                    <Text size="sm" fw={700} className="tabular-nums" style={{ color }}>
                      {increased ? '+' : '−'}¥{Math.abs(entry.diff).toLocaleString()}
                    </Text>
                  </Group>
                </Group>

                {/* 中央がゼロ。減った分は左へ、増えた分は右へ伸ばす */}
                <Box style={{ display: 'flex', height: 6, alignItems: 'center' }}>
                  <Box style={{ width: '50%', display: 'flex', justifyContent: 'flex-end' }}>
                    {!increased && (
                      <Box style={{ width: `${widthPercent * 2}%`, height: 6, borderRadius: 3, background: color }} />
                    )}
                  </Box>
                  <Box style={{ width: 1, height: 10, background: 'var(--hairline-strong)' }} />
                  <Box style={{ width: '50%' }}>
                    {increased && (
                      <Box style={{ width: `${widthPercent * 2}%`, height: 6, borderRadius: 3, background: color }} />
                    )}
                  </Box>
                </Box>

                <Group justify="space-between" mt={2}>
                  <Text size="xs" c="dimmed" className="tabular-nums">
                    {year - 1}年 ¥{entry.previous.toLocaleString()}
                  </Text>
                  <Text size="xs" c="dimmed" className="tabular-nums">
                    {year}年 ¥{entry.current.toLocaleString()}
                  </Text>
                </Group>
              </Box>
            );
          })}

          {entries.length > DISPLAY_LIMIT && (
            <Text size="xs" c="dimmed" ta="center" mt={4}>
              ほか {entries.length - DISPLAY_LIMIT} 件
            </Text>
          )}
        </Stack>
      )}
    </Paper>
  );
};
