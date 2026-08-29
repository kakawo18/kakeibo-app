'use client';

/**
 * 取引を追加するフローティングボタン
 *
 * 下部タブバーの上に浮かせる。位置は globals.css の --tabbar-height を参照するので、
 * バーの高さを変えてもここを直す必要はない（タブバーが無いデスクトップでは 0 になる）。
 * z-index はタブバー(100)より上、Mantine のモーダル(200)より下（AGENTS.md）。
 */
import { Affix, Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

interface AddTransactionFabProps {
  onClick: () => void;
  /** 取引フォームを開いている間は隠す（モーダルの上に浮かせない） */
  hidden?: boolean;
}

export const AddTransactionFab: React.FC<AddTransactionFabProps> = ({ onClick, hidden }) => (
  <Affix
    position={{
      bottom: 'calc(var(--tabbar-height) + 24px)',
      right: 18,
    }}
    style={{ zIndex: hidden ? 1 : 150 }}
  >
    <Button
      leftSection={<IconPlus size={18} stroke={2.2} />}
      onClick={onClick}
      size="md"
      radius="xl"
      style={{
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.12), 0 8px 22px rgba(76, 110, 245, 0.28)',
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
      }}
    >
      追加
    </Button>
  </Affix>
);
