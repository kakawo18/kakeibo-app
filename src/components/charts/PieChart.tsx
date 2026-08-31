'use client';

import { useMemo } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Paper, Text, Stack, Box, useComputedColorScheme } from '@mantine/core';
import { ChartData } from '@/types';
import { useMediaQuery } from '@mantine/hooks';
import { useSettings } from '@/contexts/SettingsContext';

interface PieChartBodyProps {
  data: ChartData[];
  totalAmount?: number;
  /**
   * 'donut' はドーナツ状にして中央に合計を出す（月次の内訳。既定）
   * 'pie'   は中央まで塗りつぶし、合計を出さない
   *          （年間の合計は桁数が多く、中央のスペースに収まらないため）
   */
  variant?: 'donut' | 'pie';
  /**
   * セグメントの最大数（「その他」を含む）。溢れた分は「その他」にまとめる。
   * 引き出し線ラベルは扇の角度から縦位置を決めるため、小さい扇が固まると
   * ラベル同士が重なる。年単位のようにカテゴリ数が多いときに指定する
   */
  maxSlices?: number;
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
  index: number;
  value?: number;
  payload: ChartData;
  isMobile?: boolean;
  /** 重なりを解消済みのラベル縦位置。renderLeaderLabel はこれをそのまま使う */
  labelY: number;
}

/** ラベル2行ぶんの高さ。これより近づくと文字が重なる */
const LABEL_GAP = 24;

// セグメントから引き出し線を伸ばし、カテゴリ名と金額(%)を表示する。
// ラベルは常にドーナツの左右に置き、上下方向には出さない
// （縦位置をドーナツの高さ内にクランプすることで、チャート全体の高さを
//   ドーナツ径ぎりぎりまで詰められる）
const renderLeaderLabel = (props: PieLabelProps) => {
  const { cx, cy, midAngle, outerRadius, value, payload, isMobile, labelY } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const dir = cos >= 0 ? 1 : -1;

  // 引き出し線の始点（セグメント際）
  const sx = cx + (outerRadius + 2) * cos;
  const sy = cy + (outerRadius + 2) * sin;

  // ラベル位置: 左右いずれかの固定カラム。
  // 縦は resolveLabelYs が左右それぞれで重なりを解消した値を使う
  const ey = labelY;
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
 * 支出/収入内訳の円グラフ
 *
 * 【デザイン方針】
 * - 各カテゴリの金額はセグメントからの引き出し線ラベルで表示する
 *   （リスト形式はカテゴリ数だけ行が増え、モバイルで縦に間延びするため不採用）
 * - セグメント間に隙間（paddingAngle）または背景色の線を入れ、色だけに頼らない分離を確保
 * - variant='donut'(既定) は中央に合計を出すドーナツ、variant='pie' は中央を塗りつぶした円
 * - PieChartBody はカードなしの本体。モバイルのタブ切替 UI（CategoryBreakdown）
 *   から再利用するために分離している
 */
export const PieChartBody: React.FC<PieChartBodyProps> = ({
  data,
  totalAmount,
  variant = 'donut',
  maxSlices,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  // 'auto' を実際の light/dark に解決する。useMantineColorScheme().colorScheme は
  // ユーザーが明示的に選ぶまで 'auto' のままなので、そのまま比較すると
  // OS がダークでも isDark が false になる
  const isDark = useComputedColorScheme('light', { getInitialValueInEffect: true }) === 'dark';
  const { getColor } = useSettings();
  const isDonut = variant === 'donut';
  const paddingAngle = isDonut ? 2.5 : 0;

  // データ処理: 3%未満を「その他」にまとめ、カテゴリ固定色を解決
  const processedData = useMemo(() => {
    if (!data) return [];

    const threshold = 3;
    let othersValue = 0;
    let othersPercentage = 0;

    const sortedData = [...data].sort((a, b) => b.value - a.value);
    const mainItems: ChartData[] = [];

    for (const item of sortedData) {
      // 「その他」枠を1つ残したうえで、上限を超えた分もそこへ寄せる
      const overLimit = maxSlices !== undefined && mainItems.length >= maxSlices - 1;
      if (item.name === 'その他' || item.percentage < threshold || overLimit) {
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
  }, [data, isDark, getColor, maxSlices]);

  /**
   * 引き出し線ラベルの縦位置を、左右それぞれで重ならないように決める
   *
   * 扇の中心角をそのまま縦位置にすると、小さい扇が固まったところで
   * ラベルが数pxしか離れず文字が重なる。上から順に LABEL_GAP ずつ空け、
   * 下端からはみ出した分を押し戻す。全部を収めきれない幅のときは
   * 帯の中で等間隔に配置する（重なるとしても均等になる）。
   *
   * 中心角は Recharts と同じ手順（開始0度・反時計回り・扇間に paddingAngle）で
   * 再現する。cx/cy/outerRadius は描画時にしか分からないため、扇ごとの
   * label 呼び出しの中で計算する（扇は多くても数個なので毎回計算してよい）。
   */
  const resolveLabelYs = useMemo(() => {
    const total = processedData.reduce((sum, item) => sum + item.value, 0) || 1;
    const available = 360 - paddingAngle * processedData.length;

    let cursorAngle = 0;
    const midAngles = processedData.map((item) => {
      const sweep = (available * item.value) / total;
      const mid = cursorAngle + sweep / 2;
      cursorAngle += sweep + paddingAngle;
      return mid;
    });

    return (cx: number, cy: number, outerRadius: number): number[] => {
      const top = cy - outerRadius + 10;
      const bottom = cy + outerRadius - 10;
      const ys = midAngles.map((mid) => cy + (outerRadius + 9) * Math.sin(-RADIAN * mid));

      (['right', 'left'] as const).forEach((side) => {
        const indexes = midAngles
          .map((mid, index) => ({ index, cos: Math.cos(-RADIAN * mid) }))
          .filter(({ cos }) => (side === 'right' ? cos >= 0 : cos < 0))
          .map(({ index }) => index)
          .sort((a, b) => ys[a] - ys[b]);

        if (indexes.length === 0) return;

        // 帯に収まらないときは間隔を詰めて等間隔にする
        const gap =
          indexes.length > 1
            ? Math.min(LABEL_GAP, (bottom - top) / (indexes.length - 1))
            : LABEL_GAP;

        let lower = top;
        indexes.forEach((index) => {
          ys[index] = Math.max(lower, Math.min(bottom, ys[index]));
          lower = ys[index] + gap;
        });

        let upper = bottom;
        for (let i = indexes.length - 1; i >= 0; i -= 1) {
          const index = indexes[i];
          ys[index] = Math.min(ys[index], upper);
          upper = ys[index] - gap;
        }
      });

      return ys;
    };
  }, [processedData, paddingAngle]);

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
  const innerRadius = isDonut ? 66 : 0;
  const chartHeight = outerRadius * 2 + 28;

  return (
    <Box pos="relative" w="100%" h={chartHeight}>
      {/* 中央の合計金額（ドーナツのときだけ） */}
      {isDonut && (
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
      )}

      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart margin={{ top: 4, left: 0, right: 0, bottom: 4 }}>
          <Pie
            data={processedData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(labelProps) => {
              const pieLabel = labelProps as unknown as PieLabelProps;
              const ys = resolveLabelYs(pieLabel.cx, pieLabel.cy, pieLabel.outerRadius);
              return renderLeaderLabel({
                ...pieLabel,
                isMobile,
                labelY: ys[pieLabel.index] ?? pieLabel.cy,
              });
            }}
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            dataKey="value"
            {...(isDonut
              // ドーナツは隙間で区切る。中央を埋める円グラフは隙間を空けると
              // 中心に星形の穴が空くため、背景色の細い線で区切る
              ? { paddingAngle, cornerRadius: 4, stroke: 'none' }
              : { paddingAngle, cornerRadius: 0, stroke: 'var(--app-surface)', strokeWidth: 2 })}
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

export const PieChart: React.FC<PieChartProps> = ({
  title,
  data,
  totalAmount,
  variant,
  maxSlices,
}) => (
  <Paper className="ledger-card" p="lg" h="100%">
    <Text className="section-title" mb="xs">{title}</Text>
    <PieChartBody data={data} totalAmount={totalAmount} variant={variant} maxSlices={maxSlices} />
  </Paper>
);
