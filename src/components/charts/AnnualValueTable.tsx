'use client';

/**
 * グラフの下に置く数値テーブル
 *
 * グラフは傾向を見るためのもので、金額そのものは読み取れない。
 * 凡例と同じ色見本を見出しに付けて、どの系列がどの数字かを対応付ける。
 */
import { Box, Group, Table, Text } from '@mantine/core';

export interface AnnualValueColumn {
  key: string;
  label: string;
  /** グラフの系列と対応させる色。省略すると色見本を出さない */
  color?: string;
  /** 正負で色を変え、正には + を付ける（収支など） */
  signed?: boolean;
  /** 合計列など、太字で強調する */
  emphasize?: boolean;
}

export interface AnnualValueRow {
  year: number;
  values: Record<string, number>;
}

interface AnnualValueTableProps {
  columns: AnnualValueColumn[];
  rows: AnnualValueRow[];
  /** これより狭いと横スクロールになる */
  minWidth: number;
}

const formatYen = (value: number, signed?: boolean): string => {
  const sign = signed && value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}¥${Math.abs(value).toLocaleString()}`;
};

export const AnnualValueTable: React.FC<AnnualValueTableProps> = ({ columns, rows, minWidth }) => (
  <Box mt="lg" pt="md" style={{ borderTop: '1px solid var(--hairline)' }}>
    <Table.ScrollContainer minWidth={minWidth} type="native">
      <Table fz="xs" verticalSpacing={7} horizontalSpacing="sm" withRowBorders={false}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>
              <Text size="xs" c="dimmed" fw={600}>年</Text>
            </Table.Th>
            {columns.map((column) => (
              <Table.Th key={column.key} ta="right" style={{ whiteSpace: 'nowrap' }}>
                <Group gap={5} justify="flex-end" wrap="nowrap">
                  {column.color && (
                    <Box
                      w={8}
                      h={8}
                      style={{ borderRadius: 2, background: column.color, flexShrink: 0 }}
                    />
                  )}
                  <Text size="xs" c="dimmed" fw={600}>{column.label}</Text>
                </Group>
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.year} style={{ borderTop: '1px solid var(--hairline)' }}>
              <Table.Td fw={700} style={{ whiteSpace: 'nowrap' }}>{row.year}年</Table.Td>
              {columns.map((column) => {
                const value = row.values[column.key] ?? 0;
                return (
                  <Table.Td
                    key={column.key}
                    ta="right"
                    className="tabular-nums"
                    style={{
                      whiteSpace: 'nowrap',
                      fontWeight: column.emphasize ? 700 : undefined,
                      color: column.signed
                        ? value >= 0
                          ? 'var(--income)'
                          : 'var(--expense)'
                        : undefined,
                    }}
                  >
                    {formatYen(value, column.signed)}
                  </Table.Td>
                );
              })}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
    {/* 画面が狭いと列が切れるので、横に振れることを明示する */}
    <Text size="xs" c="dimmed" mt={6} hiddenFrom="sm">
      横にスクロールすると残りの列が見られます
    </Text>
  </Box>
);
