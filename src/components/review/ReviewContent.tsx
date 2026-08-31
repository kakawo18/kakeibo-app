'use client';

/**
 * 年間振り返り (/review)
 *
 * 上段が複数年の比較、下段が選択した1年の詳細。
 * 選択中の年は URL クエリ `?year=YYYY` に持つ（ダッシュボードの `?month=` と同じ方針）。
 */
import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Container, Grid, Group, Paper, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useTransactions } from '@/contexts/TransactionsContext';
import { useSettings } from '@/contexts/SettingsContext';
import {
  calculateAnnualSummaries,
  calculateCategoryYoY,
  calculateCumulativeInvestment,
  calculateMonthlyDetail,
  getAvailableYears,
} from '@/utils/annualSummary';
import { calculateCategoryChartData } from '@/utils/calculations';
import { AnnualIncomeChart } from '@/components/charts/AnnualIncomeChart';
import { AnnualFlowChart } from '@/components/charts/AnnualFlowChart';
import { SavingsRateTrendChart } from '@/components/charts/SavingsRateTrendChart';
import { CumulativeInvestmentChart } from '@/components/charts/CumulativeInvestmentChart';
import { PieChartBody } from '@/components/charts/PieChart';
import { NetIncomeAllocation } from '@/components/review/NetIncomeAllocation';
import { CategoryYoYChart } from '@/components/charts/CategoryYoYChart';
import { MonthlyBreakdown } from '@/components/review/MonthlyBreakdown';

interface ReviewTileProps {
  label: string;
  value: string;
  note?: string;
  color?: string;
}

/** 選択年のサマリータイル */
const ReviewTile: React.FC<ReviewTileProps> = ({ label, value, note, color }) => (
  <Box
    p="md"
    style={{
      background: 'var(--app-surface-2)',
      borderRadius: 'var(--radius-tile)',
      border: '1px solid var(--hairline)',
    }}
  >
    <Text className="overline-label" mb={4}>{label}</Text>
    <Text size="lg" fw={700} className="tabular-nums" style={color ? { color } : undefined}>
      {value}
    </Text>
    {note && <Text size="xs" c="dimmed" mt={2}>{note}</Text>}
  </Box>
);

const formatYen = (amount: number): string =>
  `${amount < 0 ? '−' : ''}¥${Math.abs(amount).toLocaleString()}`;

export const ReviewContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { transactions } = useTransactions();
  const { rules, getColor } = useSettings();

  const availableYears = useMemo(() => getAvailableYears(transactions), [transactions]);
  const summaries = useMemo(
    () => calculateAnnualSummaries(transactions, rules),
    [transactions, rules]
  );
  const cumulativeInvestment = useMemo(
    () => calculateCumulativeInvestment(transactions, rules),
    [transactions, rules]
  );

  // 不正な年や取引の無い年を指定された場合は、最新の年にフォールバックする
  const requestedYear = Number(searchParams.get('year'));
  const selectedYear = availableYears.includes(requestedYear)
    ? requestedYear
    : availableYears[0] ?? new Date().getFullYear();

  const selectedSummary = summaries.find((summary) => summary.year === selectedYear);
  const monthlyDetails = useMemo(
    () => calculateMonthlyDetail(transactions, selectedYear, rules),
    [transactions, selectedYear, rules]
  );
  const categoryYoY = useMemo(
    () => calculateCategoryYoY(transactions, selectedYear, rules),
    [transactions, selectedYear, rules]
  );
  // 年間のカテゴリ別支出。ホームの月次内訳と同じ集計（サブカテゴリ優先・投資などは除外）
  const categoryExpense = useMemo(
    () =>
      calculateCategoryChartData(
        transactions.filter((t) => t.date.getFullYear() === selectedYear),
        'expense',
        rules,
        getColor
      ),
    [transactions, selectedYear, rules, getColor]
  );

  const handleYearChange = (value: string | null) => {
    if (!value) return;
    const params = new URLSearchParams(searchParams);
    params.set('year', value);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  if (transactions.length === 0) {
    return (
      <Container size="lg">
        <Paper className="ledger-card" p="xl">
          <Stack align="center" gap="xs">
            <Text fw={700}>まだ振り返るデータがありません</Text>
            <Text size="sm" c="dimmed" ta="center">
              取引を記録すると、年ごとの収入・支出・投資の推移をここで見返せます。
            </Text>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="lg">
      <Stack gap="md">
        {/* 複数年の比較 */}
        <AnnualIncomeChart summaries={summaries} />

        <Paper className="ledger-card" p="lg">
          <Text className="section-title" mb={6}>額面の推定について</Text>
          <Text size="xs" c="dimmed">
            このアプリが記録しているのは口座に入った金額（手取り）だけなので、額面は税と社会保険料から
            逆算した概算です。協会けんぽ・一般の事業・40歳未満・扶養なしを前提に、健康保険・厚生年金・
            雇用保険・所得税・住民税を年分ごとの料率で計算しています。介護保険料、扶養控除、生命保険料控除、
            住宅ローン控除、iDeCo、ふるさと納税、財形貯蓄や社宅費などの天引きは含みません。
            対象は「給与収入」の役割を付けたカテゴリの収入だけです。
          </Text>
        </Paper>

        <AnnualFlowChart summaries={summaries} />

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <SavingsRateTrendChart summaries={summaries} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <CumulativeInvestmentChart data={cumulativeInvestment} />
          </Grid.Col>
        </Grid>

        {/* ここから選択した1年の詳細 */}
        <Group justify="space-between" align="center" mt="xs">
          <Text className="section-title">1年を詳しく見る</Text>
          <Select
            data={availableYears.map((year) => ({ value: String(year), label: `${year}年` }))}
            value={String(selectedYear)}
            onChange={handleYearChange}
            size="sm"
            w={120}
            allowDeselect={false}
            searchable={!isMobile}
            aria-label="表示する年"
          />
        </Group>

        {selectedSummary && (
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing="sm">
            <ReviewTile
              label="年収(額面・推定)"
              value={formatYen(selectedSummary.estimatedGross)}
              note="給与のみ"
            />
            <ReviewTile
              label="年収(手取り)"
              value={formatYen(selectedSummary.netIncome)}
              color="var(--income)"
            />
            <ReviewTile
              label="年間支出"
              value={formatYen(selectedSummary.expense)}
              note="投資を除く"
              color="var(--expense)"
            />
            <ReviewTile
              label="年間投資額"
              value={formatYen(selectedSummary.investment)}
              color="var(--series-investment)"
            />
            <ReviewTile
              label="貯蓄率"
              value={`${selectedSummary.savingsRate.toFixed(1)}%`}
              note="投資 ÷ 給与収入"
              color="var(--accent)"
            />
          </SimpleGrid>
        )}

        {selectedSummary && <NetIncomeAllocation summary={selectedSummary} />}

        {/* 年間合計は桁が多く中央に収まらないため、中央を塗りつぶした円グラフにする。
            年単位はカテゴリ数が多く引き出し線ラベルが重なるので、扇の数に上限を置く */}
        <Paper className="ledger-card" p="lg">
          <Text className="section-title" mb="xs">{selectedYear}年 カテゴリ別支出の内訳</Text>
          {/* 幅の広い画面で円が中央にぽつんと残らないよう、描画幅を絞る */}
          <Box maw={560} mx="auto">
            <PieChartBody data={categoryExpense} variant="pie" maxSlices={6} />
          </Box>
        </Paper>

        <CategoryYoYChart
          year={selectedYear}
          entries={categoryYoY}
          hasPreviousYear={availableYears.includes(selectedYear - 1)}
        />

        <MonthlyBreakdown year={selectedYear} details={monthlyDetails} />
      </Stack>
    </Container>
  );
};
