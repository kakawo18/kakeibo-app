'use client';

import { useMemo } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Paper, Text, Stack, Box, useMantineColorScheme } from '@mantine/core';
import { ChartData } from '@/types';
import { useMediaQuery } from '@mantine/hooks';
import { useSettings } from '@/contexts/SettingsContext';

interface PieChartBodyProps {
  data: ChartData[];
  totalAmount?: number;
}

interface PieChartProps extends PieChartBodyProps {
  title: string;
}

const RADIAN = Math.PI / 180;

// SVG の <text> は自動で折り返し・切り詰めできないため、
// 全角/半角を区別したおおよその描画幅からラベルの x 座標をクランプする
const estimateTextWidth = (text: string, fontSize: number): number => {
  let width = 0;
  for (const ch of text) {
    width += ch.charCodeAt(0) > 0xff ? fontSize : fontSize * 0.58;
  }
  return width;
};

interface PieLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  value?: number;
  payload: ChartData;
  isMobile?: boolean;
}

// セグメントから引き出し線を伸ばし、カテゴリ名と金額(%)を表示する。
// ラベルは常にドーナツの左右に置き、上下方向には出さない
// （縦位置をドーナツの高さ内にクランプすることで、チャート全体の高さを
//   ドーナツ径ぎりぎりまで詰められる）
const renderLeaderLabel = (props: PieLabelProps) => {
  const { cx, cy, midAngle, outerRadius, value, payload, isMobile } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const dir = cos >= 0 ? 1 : -1;

  // 引き出し線の始点（セグメント際）
  const sx = cx + (outerRadius + 2) * cos;
  const sy = cy + (outerRadius + 2) * sin;

  // ラベル位置: 左右いずれかの固定カラム。
  // 縦はセグメント角度の投影を使いつつ、ドーナツの縦帯内に収める
  const rawY = cy + (outerRadius + 9) * sin;
  const ey = Math.max(cy - outerRadius + 10, Math.min(cy + outerRadius - 10, rawY));
  const bendX = cx + dir * (outerRadius + (isMobile ? 6 : 12));
  const ex = cx + dir * (outerRadius + (isMobile ? 10 : 20));
  const textAnchor = dir >= 0 ? 'start' : 'end';
  let tx = ex + dir * 3;

  // 画面端でのラベル見切れ防止:
  // ラベル2行（カテゴリ名・金額）の広い方が収まるよう x をコンテナ内に押し戻す。
  // margin は左右 0 のため cx * 2 ≒ チャート幅
  const nameSize = isMobile ? 10 : 12;
  const amountSize = isMobile ? 9 : 11;
  const amountText = `¥${(value || 0).toLocaleString()} (${Number(payload.percentage ?? 0).toFixed(1)}%)`;
  const labelWidth = Math.max(
    estimateTextWidth(payload.name, nameSize),
    estimateTextWidth(amountText, amountSize)
  );
  const chartWidth = cx * 2;
  if (dir >= 0) {
    tx = Math.min(tx, chartWidth - 4 - labelWidth);
  } else {
    tx = Math.max(tx, 4 + labelWidth);
  }

  return (
    <g>
      <path d={`M${sx},${sy}L${bendX},${ey}L${ex},${ey}`} stroke={payload.color} fill="none" strokeWidth={1} />
      <circle cx={ex} cy={ey} r={1.8} fill={payload.color} stroke="none" />
      {/* stroke(縁取り)は、クランプでラベルがドーナツに重なったときの可読性確保 */}
      <text
        x={tx}
        y={ey}
        dy={-4}
        textAnchor={textAnchor}
        fill="var(--ink-1)"
        fontSize={nameSize}
        fontWeight={600}
        stroke="var(--app-surface)"
        strokeWidth={3}
        paintOrder="stroke"
      >
        {payload.name}
      </text>
      <text
        x={tx}
        y={ey}
        dy={isMobile ? 8 : 10}
        textAnchor={textAnchor}
        fill="var(--ink-3)"
        fontSize={amountSize}
        stroke="var(--app-surface)"
        strokeWidth={3}
        paintOrder="stroke"
      >
        {amountText}
      </text>
    </g>
  );
};

/**
 * 支出/収入内訳のドーナツチャート
 *
 * 【デザイン方針】
 * - 各カテゴリの金額はセグメントからの引き出し線ラベルで表示する
 *   （リスト形式はカテゴリ数だけ行が増え、モバイルで縦に間延びするため不採用）
 * - セグメント間に隙間（paddingAngle）を入れ、色だけに頼らない分離を確保
 * - PieChartBody はカードなしの本体。モバイルのタブ切替 UI（CategoryBreakdown）
 *   から再利用するために分離している
 */
export const PieChartBody: React.FC<PieChartBodyProps> = ({ data, totalAmount }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const { getColor } = useSettings();

  // データ処理: 3%未満を「その他」にまとめ、カテゴリ固定色を解決
  const processedData = useMemo(() => {
    if (!data) return [];

    const threshold = 3;
    let othersValue = 0;
    let othersPercentage = 0;

    const sortedData = [...data].sort((a, b) => b.value - a.value);
    const mainItems: ChartData[] = [];

    for (const item of sortedData) {
      if (item.name === 'その他' || item.percentage < threshold) {
        othersValue += item.value;
        othersPercentage += item.percentage;
      } else {
        mainItems.push({ ...item, color: getColor(item.name, isDark) });
      }
    }

    if (othersValue > 0) {
      mainItems.push({
        name: 'その他',
        value: othersValue,
        percentage: Number(othersPercentage.toFixed(1)),
        color: getColor('その他', isDark),
      });
    }

    return mainItems;
  }, [data, isDark, getColor]);

  const displayTotal = totalAmount ?? data?.reduce((sum, item) => sum + item.value, 0) ?? 0;

  if (!data || data.length === 0) {
    return (
      <Text ta="center" c="dimmed" py="xl" size="sm">
        データがありません
      </Text>
    );
  }

  // ラベルを左右固定にしたことで上下に空き領域が不要になったため、
  // 枠の高さをドーナツ径ぎりぎりまで詰める（横長のフレームにする）
  const outerRadius = 96;
  const innerRadius = 66;
  const chartHeight = outerRadius * 2 + 28;

  return (
    <Box pos="relative" w="100%" h={chartHeight}>
      {/* 中央の合計金額 */}
      <Stack
        gap={2}
        align="center"
        justify="center"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none'
        }}
      >
        <Text className="overline-label">合計</Text>
        <Text
          fw={700}
          className="tabular-nums"
          style={{ fontSize: isMobile ? 15 : 18, letterSpacing: '-0.02em', lineHeight: 1 }}
        >
          <span className="amount-symbol">¥</span>
          {displayTotal.toLocaleString()}
        </Text>
      </Stack>

      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart margin={{ top: 4, left: 0, right: 0, bottom: 4 }}>
          <Pie
            data={processedData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(labelProps) => renderLeaderLabel({ ...(labelProps as unknown as PieLabelProps), isMobile })}
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            dataKey="value"
            paddingAngle={2.5}
            cornerRadius={4}
            stroke="none"
            isAnimationActive={false}
          >
            {processedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string, tooltipProps: { payload?: ChartData }) => [
              `¥${value.toLocaleString()}（${(tooltipProps.payload?.percentage ?? 0).toFixed(1)}%）`,
              name,
            ]}
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
        </RechartsPieChart>
      </ResponsiveContainer>
    </Box>
  );
};

export const PieChart: React.FC<PieChartProps> = ({ title, data, totalAmount }) => (
  <Paper className="ledger-card" p="lg" h="100%">
    <Text className="section-title" mb="xs">{title}</Text>
    <PieChartBody data={data} totalAmount={totalAmount} />
  </Paper>
);
