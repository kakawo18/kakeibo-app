'use client';

/**
 * 設定画面の「Claude との接続」欄（docs/claude-connector/仕様書.md 5.10）
 *
 * 接続中か（家計簿の側にまだ使えるリフレッシュトークンがあるか）を表示し、解除できるようにする。
 * Claude の側でコネクタを削除しても家計簿の側のトークンは残るので、ここで消す。
 * Claude 連携が無効な環境（API が 404）では欄ごと出さない。
 */
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconPlugConnectedX } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';

type ConnectionState = 'loading' | 'unavailable' | 'error' | 'connected' | 'disconnected';

export const ClaudeConnectionSection = () => {
  const { user } = useAuth();
  const [state, setState] = useState<ConnectionState>('loading');
  const [revoking, setRevoking] = useState(false);

  const request = useCallback(
    async (method: 'GET' | 'DELETE') => {
      if (!user) throw new Error('not signed in');
      const idToken = await user.getIdToken();
      return fetch('/api/oauth/connections', { method, headers: { Authorization: `Bearer ${idToken}` } });
    },
    [user]
  );

  const refresh = useCallback(async () => {
    try {
      const response = await request('GET');
      if (response.status === 404) return setState('unavailable');
      if (!response.ok) return setState('error');
      const body = (await response.json()) as { connected?: boolean };
      setState(body.connected ? 'connected' : 'disconnected');
    } catch {
      setState('error');
    }
  }, [request]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const revoke = async () => {
    setRevoking(true);
    try {
      const response = await request('DELETE');
      if (!response.ok) throw new Error(`status ${response.status}`);
      setState('disconnected');
      notifications.show({
        title: '接続を解除しました',
        message: 'Claude からは1時間以内に使えなくなります。Claude の側のコネクタも削除してください。',
        color: 'teal',
      });
    } catch {
      notifications.show({
        title: 'エラー',
        message: '接続を解除できませんでした。時間をおいてもう一度お試しください。',
        color: 'red',
      });
    }
    setRevoking(false);
  };

  const confirmRevoke = () =>
    modals.openConfirmModal({
      title: 'Claude との接続を解除',
      children: (
        <Text size="sm">
          {'Claude から家計簿を読み取れないようにします。すでに渡した通行証が切れるまで、最長1時間は読み取れることがあります。' +
            'もう一度使うときは、Claude のコネクタの画面から接続し直してください。'}
        </Text>
      ),
      labels: { confirm: '解除する', cancel: 'キャンセル' },
      confirmProps: { color: 'red' },
      onConfirm: () => void revoke(),
    });

  if (state === 'unavailable') return null;

  return (
    <Paper className="ledger-card" p="lg">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div>
            <Text className="section-title" mb={4}>Claude との接続</Text>
            <Text size="xs" c="dimmed">
              Claude（claude.ai）のチャットから、この家計簿を読み取り専用で検索・集計できます。取引や設定は変更されません
            </Text>
          </div>
          {/* 説明文に押されて縮まないようにする（スマホ幅で「接…」と切れていた） */}
          {state === 'connected' && <Badge variant="light" color="teal" style={{ flexShrink: 0 }}>接続中</Badge>}
          {state === 'disconnected' && <Badge variant="light" color="gray" style={{ flexShrink: 0 }}>未接続</Badge>}
        </Group>

        {state === 'error' && (
          <Text size="xs" c="dimmed">
            接続の状態を確認できませんでした。時間をおいて開き直してください。
          </Text>
        )}

        {state === 'connected' && (
          <Group justify="flex-end">
            <Button
              variant="light"
              color="red"
              size="xs"
              leftSection={<IconPlugConnectedX size={14} />}
              loading={revoking}
              onClick={confirmRevoke}
            >
              接続を解除
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
};
