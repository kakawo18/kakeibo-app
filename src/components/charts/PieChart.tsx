'use client';

import { useMemo, useState } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Sector
} from 'recharts';
import { Paper, Text, Stack, Box } from '@mantine/core';
import { motion } from 'framer-motion';
import { ChartData } from '@/types';
import { useMediaQuery } from '@mantine/hooks';

interface PieChartProps {
  title: string;
  data: ChartData[];
  totalAmount?: number;
  color?: string;
}

const RADIAN = Math.PI / 180;

const renderCustomizedLabel = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, value, payload, percent, isMobile } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);

  // モバイルの場合はラベルの距離を極限まで縮める
  // radiusが大きいため、線は短くて良い
  const sx = cx + (outerRadius + 2) * cos;
  const sy = cy + (outerRadius + 2) * sin;
  const mx = cx + (outerRadius + (isMobile ? 10 : 30)) * cos;
  const my = cy + (outerRadius + (isMobile ? 10 : 30)) * sin;
  // 線を横に伸ばす長さ
  const ex = mx + (cos >= 0 ? 1 : -1) * (isMobile ? 5 : 22);
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  // パーセンテージの計算: payload.percentage (0-100) があればそれを使用、なければ percent (0-1) から計算
  const percentageValue = payload.percentage !== undefined && !isNaN(payload.percentage)
    ? payload.percentage
    : (percent || 0) * 100;

  return (
    <g>
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={payload.color || '#888'} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={payload.color || '#888'} stroke="none" />
      <text
        x={ex + (cos >= 0 ? 1 : -1) * (isMobile ? 3 : 12)}
        y={ey}
        textAnchor={textAnchor}
        fill="var(--mantine-color-text)"
        fontSize={isMobile ? 10 : 12}
        dy={-6}
        fontWeight={600}
      >
        {payload.name}
      </text>
      <text
        x={ex + (cos >= 0 ? 1 : -1) * (isMobile ? 3 : 12)}
        y={ey}
        dy={10}
        textAnchor={textAnchor}
        fill="var(--mantine-color-dimmed)"
        fontSize={isMobile ? 9 : 11}
      >
        {`¥${(value || 0).toLocaleString()} (${Number(percentageValue).toFixed(1)}%)`}
      </text>
    </g>
  );
};

// 内側のラベル（カテゴリ名のみ）
const renderInnerLabel = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, payload, percent } = props;
  if (percent < 0.05) return null; // 小さいセグメントは表示しない

  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {payload.name.substring(0, 4)}
    </text>
  );
};

export const PieChart: React.FC<PieChartProps> = ({
  title,
  data,
  totalAmount,
  color = 'blue'
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  // データ処理: 3%未満を「その他」にまとめる
  const processedData = useMemo(() => {
    if (!data) return [];

    const threshold = 3;
    let othersValue = 0;
    let othersPercentage = 0;

    // ソート: 降順
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    const mainItems = [];

    for (const item of sortedData) {
      if (item.name === 'その他' || item.percentage < threshold) {
        othersValue += item.value;
        othersPercentage += item.percentage;
      } else {
        mainItems.push({ ...item });
      }
    }

    if (othersValue > 0) {
      mainItems.push({
        name: 'その他',
        value: othersValue,
        percentage: Number(othersPercentage.toFixed(1)), // 正しいパーセンテージを渡す
        color: 'gray.5'
      });
    }

    // カラーコード解決（Mantineの色をHEXに変換するか、CSS変数を解決する必要があるが、
    // RechartsはHEXを好む。ここでは簡易的なHEXマップか、CSS変数を使う）
    // 手抜きで申し訳ないが、CSS変数 var(--mantine-primary-color-filled) などはSVG内で効かないことがある。
    // しかし、Mantineのカラーパレットをハードコードするのは保守性が悪い。
    // ここでは既定のカテゴリカラー（HEX）があればそれを使い、なければMantineのCSS変数を渡してみる（最新ブラウザなら動く）。

    return mainItems.map((item, index) => {
      let finalColor = item.color;
      // マッピング修正: グローバルCSS変数ではなく具体的な色値が必要なケースが多い
      if (item.name === 'その他') finalColor = '#9CA3AF'; // gray.400
      else if (!finalColor || finalColor.includes('.')) {
        // 簡易パレット (Tailwind/Mantine default colors approximate)
        const palette = ['#228BE6', '#FA5252', '#12B886', '#FAB005', '#7950F2', '#E64980', '#82C91E'];
        finalColor = palette[index % palette.length];
      }
      return {
        ...item,
        color: finalColor
      };
    });
  }, [data, color]);

  const displayTotal = totalAmount ?? data?.reduce((sum, item) => sum + item.value, 0) ?? 0;

  if (!data || data.length === 0) {
    return (
      <Paper withBorder p="md">
        <Text size="lg" fw={600} mb="md">{title}</Text>
        <Text ta="center" c="dimmed" py="xl">
          データがありません
        </Text>
      </Paper>
    );
  }

  // スマホの場合はラベルをシンプルにするなどの調整が必要だが、
  // リクエストの画像はPCレイアウトっぽいので、ResponsiveContainerで縮小させる。
  // 余白を埋めるために半径をさらに攻める (105/150)
  // 105px = 直径210px. iPhone SE(320px)でも 320-210 = 110px余白 -> 片側55px. ラベルには十分.
  const outerRadius = isMobile ? 105 : 150;
  // リングの太さはある程度維持
  const innerRadius = isMobile ? 65 : 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Paper withBorder p={0} radius="md" style={{ overflow: 'hidden' }}>
        <Text size="lg" fw={600} mt="sm" ml="sm">{title}</Text>

        {/* 高さを調整して、無駄な上下の余白を削除 (380 -> 300) */}
        <Box pos="relative" h={isMobile ? 300 : 400} w="100%">
          {/* Center Text */}
          <Stack
            gap={0}
            align="center"
            justify="center"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1,
              pointerEvents: 'none'
            }}
          >
            <Text size="xs" c="dimmed" fw={600}>Total</Text>
            <Text size={isMobile ? "xl" : "2xl"} fw={700}>¥{displayTotal.toLocaleString()}</Text>
          </Stack>

          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart margin={{ top: 0, left: 0, right: 0, bottom: 0 }}>
              <Pie
                data={processedData}
                cx="50%"
                cy="50%"
                labelLine={false} // Custom renderer draws the line
                // @ts-ignore - Recharts types are tricky with custom props
                label={(props) => renderCustomizedLabel({ ...props, isMobile })}
                outerRadius={outerRadius}
                innerRadius={innerRadius}
                fill="#8884d8"
                dataKey="value"
                paddingAngle={2}
                cornerRadius={4}
              >             {processedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
              ))}
                {/* Inside Label (Optional, matches screenshot) - LabelList is alternative but custom label prop inside Pie works too? 
                             No, 'label' prop is ONE label. 
                             To have inside AND outside, we can use a second Pie with transparent fill OR use LabelList? 
                             Actually, 'label' prop handles the outside. 
                             We can try to put text inside via a localized component but Recharts 'label' is singular.
                             Let's stick to Outside for now as it's the main request.
                         */}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string, props: any) => [
                  `¥${value.toLocaleString()} (${(props.payload.percent * 100).toFixed(1)}%)`, // percentage is missing in re-calc? Recharts calculates 'percent' (0-1)
                  name
                ]}
              />
            </RechartsPieChart>
          </ResponsiveContainer>
        </Box>
      </Paper>
    </motion.div>
  );
};