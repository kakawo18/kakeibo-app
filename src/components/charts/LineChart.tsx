'use client';

import { useState, useMemo } from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Paper, Text, Group, MultiSelect, ActionIcon, Box, Stack, useComputedColorScheme } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { Transaction } from '@/types';
import { getCurrentMonth, getMonthName } from '@/utils/dateUtils';
import { calculateCategoryTrend } from '@/utils/calculations';
import { useSettings } from '@/contexts/SettingsContext';

const DISPLAY_MONTHS = 6; // 一度に表示する月数

interface LineChartProps {
  title: string;
  transactions?: Transaction[]; // カテゴリ分析用
}

export const LineChart: React.FC<LineChartProps> = ({ title, transactions = [] }) => {
  // 'auto' を実際の light/dark に解決する。useMantineColorScheme().colorScheme は
  // ユーザーが明示的に選ぶまで 'auto' のままなので、そのまま比較すると
  // OS がダークでも isDark が false になる
  const isDark = useComputedColorScheme('light', { getInitialValueInEffect: true }) === 'dark';
  const { rules, getColor, settings, updateSettings } = useSettings();

  // 月ごとのカテゴリ別支出。ホームの支出と同じ除外ルールで数え、
  // 取引の無い月も0で埋めて連続させる（#100 #118）
  const trend = useMemo(
    () => calculateCategoryTrend(transactions, rules, getCurrentMonth()),
    [transactions, rules]
  );
  // ユーザーが明示的に選択するまでは支出Top 3カテゴリをデフォルト表示。
  // 選択は設定ドキュメント（Firestore）に保存する。以前は localStorage に
  // 置いていたが、iOS のホーム画面アプリでは起動をまたいで消えることがあり、
  // 開くたびに既定へ戻っていた
  // 改名したカテゴリは今の名前に読み替える（#97。保存値は書き換えない）
  const savedCategories = settings?.chartPreferences?.categoryTrendCategories;
  const userSelectedCategories = useMemo(
    () =>
      savedCategories
        ? Array.from(new Set(savedCategories.map((category) => rules.categoryName({ category }))))
        : null,
    [savedCategories, rules]
  );

  const handleSelectedCategoriesChange = (value: string[]) => {
    // Firestore はローカル書き込みを即座に onSnapshot へ反映するため、
    // オフラインでも選択は待たずに画面へ出る
    updateSettings({
      chartPreferences: { ...settings?.chartPreferences, categoryTrendCategories: value },
    }).catch(() => {
      notifications.show({
        title: 'エラー',
        message: '表示するカテゴリの保存に失敗しました',
        color: 'red',
      });
    });
  };

  // ユーザーがページングするまでは常に最新期間を表示する
  // （固定値で初期化すると、データ月数が変わったとき初期表示がずれる）
  const [userStartIndex, setUserStartIndex] = useState<number | null>(null);

  // 支出Top 3カテゴリ（デフォルト選択用）
  const defaultTopCategories = useMemo(
    () => trend.categoriesBySpending.slice(0, 3),
    [trend]
  );

  // 利用可能なカテゴリを取得
  const availableCategories = useMemo(
    () => trend.categories.map((cat) => ({ value: cat, label: cat })),
    [trend]
  );

  // 保存済みの選択のうち、現在の取引に存在しないカテゴリ（改名・削除された等）は除外する。
  // 保存値自体は書き換えないため、該当カテゴリの取引が戻れば再び表示される。
  const selectedCategories = useMemo(() => {
    const available = new Set(trend.categories);
    return (userSelectedCategories ?? defaultTopCategories).filter(category =>
      available.has(category)
    );
  }, [userSelectedCategories, defaultTopCategories, trend]);

  // 全データを計算（スライス前）。X軸のラベルは YYYY/MM
  const allCategoryData = useMemo(
    () =>
      trend.months.map(({ month, totals }) => ({
        month: getMonthName(month).replace('年', '/').replace('月', ''),
        ...totals,
      })),
    [trend]
  );

  // 表示開始位置（未操作時は最新の6ヶ月）と表示データ
  const displayStartIndex = userStartIndex ?? Math.max(0, allCategoryData.length - DISPLAY_MONTHS);

  const categoryData = useMemo(
    () => allCategoryData.slice(displayStartIndex, displayStartIndex + DISPLAY_MONTHS),
    [allCategoryData, displayStartIndex]
  );

  // ページング制御
  const canGoPrev = displayStartIndex > 0;
  const canGoNext = displayStartIndex + DISPLAY_MONTHS < allCategoryData.length;

  const handlePrev = () => {
    if (canGoPrev) {
      setUserStartIndex(Math.max(0, displayStartIndex - DISPLAY_MONTHS));
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      setUserStartIndex(Math.min(allCategoryData.length - DISPLAY_MONTHS, displayStartIndex + DISPLAY_MONTHS));
    }
  };

  if (allCategoryData.length === 0) {
    return (
      <Paper className="ledger-card" p="lg">
        <Text className="section-title">{title}</Text>
        <Text ta="center" c="dimmed" py="xl" size="sm">
          データがありません
        </Text>
      </Paper>
    );
  }

  // ツールチップのフォーマッター
  const tooltipFormatter = (value: number, name: string) => {
    return [`¥${value.toLocaleString()}`, name];
  };

  return (
    <Paper className="ledger-card" p="lg">
      <Group justify="space-between" mb="md">
        <Stack gap={2}>
          <Text className="section-title">{title}</Text>
          <Text size="xs" c="dimmed">月別の推移を比較</Text>
        </Stack>
      </Group>

      {/* ページングコントロール */}
      {allCategoryData.length > DISPLAY_MONTHS && (
        <Group justify="center" mb="sm" gap="xs">
          <ActionIcon
            variant="default"
            size="md"
            radius={8}
            onClick={handlePrev}
            disabled={!canGoPrev}
            aria-label="前の期間へ"
          >
            <IconChevronLeft size={15} stroke={1.8} />
          </ActionIcon>
          <Text size="xs" c="dimmed" className="tabular-nums">
            {displayStartIndex + 1} - {Math.min(displayStartIndex + DISPLAY_MONTHS, allCategoryData.length)} / {allCategoryData.length}ヶ月
          </Text>
          <ActionIcon
            variant="default"
            size="md"
            radius={8}
            onClick={handleNext}
            disabled={!canGoNext}
            aria-label="次の期間へ"
          >
            <IconChevronRight size={15} stroke={1.8} />
          </ActionIcon>
        </Group>
      )}

      {/* カテゴリ選択 */}
      <MultiSelect
        data={availableCategories}
        value={selectedCategories}
        onChange={handleSelectedCategoriesChange}
        placeholder="比較するカテゴリを選択"
        size="sm"
        mb="lg"
        maxValues={5}
        searchable
        clearable
        hidePickedOptions
      />

      <Box h={280}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart
            data={categoryData}
            margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
          >
            <CartesianGrid stroke="var(--grid-line)" strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--hairline-strong)' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${(value / 10000).toFixed(0)}万`}
              width={36}
            />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{
                background: 'var(--app-surface)',
                border: '1px solid var(--hairline-strong)',
                borderRadius: '10px',
                boxShadow: 'var(--shadow-raised)',
                fontSize: '12px',
                color: 'var(--ink-1)',
                padding: '8px 12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--ink-2)' }} iconType="plainline" />
            {selectedCategories.map((category) => (
              <Line
                key={category}
                type="monotone"
                dataKey={category}
                stroke={getColor(category, isDark)}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: getColor(category, isDark) }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--app-surface)' }}
                connectNulls={false}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};