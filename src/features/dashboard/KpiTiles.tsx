'use client';

/**
 * ホームの KPI タイル: 貯蓄率 / 獲得ポイント / 年間投資額（#124 で DashboardContent から分離）
 */
import { Group, Paper, SimpleGrid, Text } from '@mantine/core';
import { IconTrendingUp, IconWallet, IconCoins } from '@tabler/icons-react';
import { pressable } from '@/components/ui/pressable';
import { YearlySavings } from '@/domain/annualSummary';

// ============================================================
// KPIタイル（アイコンは無彩色 — 色は意味のある数値だけに使う）
// ============================================================
const KpiTile = ({
  label,
  value,
  unit,
  icon,
  compact,
  onClick,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  compact?: boolean;
  onClick?: () => void;
}) => (
  <Paper
    className={`ledger-card ${onClick ? 'ledger-card-clickable' : ''}`}
    p={compact ? 12 : 'md'}
    // 押すと詳細が開くタイルは、キーボード・読み上げからも押せるようにする（#111）
    {...(onClick ? pressable(onClick, `${label}の詳細を開く`) : {})}
    // 3列グリッドで金額が長いときにタイルがグリッドを押し広げないようにする
    style={{ minWidth: 0 }}
  >
    {/* compact（モバイル3列）ではアイコンを省き字間も詰めて、
        「獲得ポイント」等のラベルが省略記号で欠けないようにする */}
    <Group gap={6} mb={compact ? 8 : 10} c="var(--ink-3)" wrap="nowrap">
      {!compact && icon}
      <Text
        className="overline-label"
        truncate
        style={compact ? { fontSize: 11, letterSpacing: '0.01em' } : undefined}
      >
        {label}
      </Text>
    </Group>
    <Text
      fw={700}
      className="tabular-nums"
      truncate
      style={{ fontSize: compact ? 17 : 20, lineHeight: 1.1, letterSpacing: '-0.015em' }}
    >
      {value}
      {unit && <Text component="span" size="xs" c="dimmed" fw={600}> {unit}</Text>}
    </Text>
  </Paper>
);

interface KpiTilesProps {
  savingsData: YearlySavings;
  monthlyCardPoints: number;
  isMobile: boolean;
  onOpenSavingsRate: () => void;
  onOpenCardRewards: () => void;
  onOpenInvestmentHistory: () => void;
}

export const KpiTiles = ({
  savingsData,
  monthlyCardPoints,
  isMobile,
  onOpenSavingsRate,
  onOpenCardRewards,
  onOpenInvestmentHistory,
}: KpiTilesProps) => (
    <SimpleGrid cols={3} spacing={isMobile ? 'xs' : 'md'}>
      <KpiTile
        label="貯蓄率"
        value={savingsData.savingsRate.toFixed(1)}
        unit="%"
        icon={<IconTrendingUp size={14} stroke={1.8} />}
        compact={isMobile}
        onClick={onOpenSavingsRate}
      />
      <KpiTile
        label="獲得ポイント"
        value={monthlyCardPoints.toLocaleString()}
        unit="pt"
        icon={<IconCoins size={14} stroke={1.8} />}
        compact={isMobile}
        onClick={onOpenCardRewards}
      />
      <KpiTile
        label="年間投資額"
        value={`¥${savingsData.investment.toLocaleString()}`}
        icon={<IconWallet size={14} stroke={1.8} />}
        compact={isMobile}
        onClick={onOpenInvestmentHistory}
      />
    </SimpleGrid>
);
