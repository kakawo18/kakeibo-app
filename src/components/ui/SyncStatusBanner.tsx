'use client';

/**
 * 通信状態と未送信の変更の表示（#110 / #126）
 *
 * オフラインでも記録・編集は端末に保存され、通信が戻ると Firestore が自動で送信する。
 * 保存したのにサーバーへ届いていない状態を利用者が見分けられるよう、
 * オフライン中と、未送信の変更が残っているあいだだけ表示する。
 */
import { useEffect } from 'react';
import { Container, Group, Text } from '@mantine/core';
import { useNetwork } from '@mantine/hooks';
import { IconCloudOff, IconCloudUpload } from '@tabler/icons-react';
import { usePendingWrites, watchPendingWrites } from '@/contexts/pendingWrites';

export const SyncStatusBanner = () => {
  const { online } = useNetwork();
  const hasPendingWrites = usePendingWrites();

  // 前回オフラインで保存したまま閉じた変更が残っていれば、起動時から表示する
  useEffect(() => {
    watchPendingWrites();
  }, []);

  if (online && !hasPendingWrites) return null;

  const Icon = online ? IconCloudUpload : IconCloudOff;
  const message = online
    ? '未送信の変更を送信しています…'
    : hasPendingWrites
      ? 'オフラインです。未送信の変更はこの端末に保存されていて、通信が戻ると自動で送信します'
      : 'オフラインです。記録・編集はこの端末に保存され、通信が戻ると自動で送信します';

  return (
    <Container size="lg" pt="sm">
      <Group
        gap={8}
        wrap="nowrap"
        role="status"
        aria-live="polite"
        px="sm"
        py={8}
        style={{
          border: '1px solid var(--hairline-strong)',
          borderRadius: 'var(--radius-control)',
          background: 'var(--app-surface-2)',
        }}
      >
        <Icon size={16} style={{ flexShrink: 0, color: 'var(--ink-2)' }} aria-hidden />
        <Text size="xs" style={{ color: 'var(--ink-2)' }}>
          {message}
        </Text>
      </Group>
    </Container>
  );
};
