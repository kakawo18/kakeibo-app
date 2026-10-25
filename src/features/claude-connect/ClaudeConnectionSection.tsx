'use client';

/**
 * 設定画面の「Claude との接続」欄（docs/claude-connector/仕様書.md 5.10）
 *
 * まだ使える接続（家計簿の側に使えるリフレッシュトークンがある接続）を、許可した日時と最後に使った時期つきで並べ、
 * 1つずつ、またはまとめて解除できるようにする。パスワードが漏れて他人に接続を作られたときに
 * 気づけるよう一覧で見せる（#178）。
 * Claude の側でコネクタを削除しても家計簿の側のトークンは残るので、ここで消す。
 * Claude 連携が無効な環境（API が 404）では欄ごと出さない。
 */
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconPlugConnectedX } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';

interface Connection {
  id: string;
  connectedAt: string;
  lastActiveAt: string;
}

type ConnectionState =
  | { status: 'loading' | 'unavailable' | 'error' }
  | { status: 'loaded'; connections: Connection[] };

const formatDateTime = (iso: string) => dayjs(iso).format('YYYY/M/D HH:mm');

export const ClaudeConnectionSection = () => {
  const { user } = useAuth();
  const [state, setState] = useState<ConnectionState>({ status: 'loading' });
  /** 解除中の接続の id（'all' はまとめて解除） */
  const [revoking, setRevoking] = useState<string | null>(null);

  const request = useCallback(
    async (method: 'GET' | 'DELETE', connectionId?: string) => {
      if (!user) throw new Error('not signed in');
      const idToken = await user.getIdToken();
      const query = connectionId ? `?id=${encodeURIComponent(connectionId)}` : '';
      // 接続の状態は常に最新を取る（Service Worker も /api/ はキャッシュしない。#180）
      return fetch(`/api/oauth/connections${query}`, {
        method,
        headers: { Authorization: `Bearer ${idToken}` },
        cache: 'no-store',
      });
    },
    [user]
  );

  const refresh = useCallback(async () => {
    try {
      const response = await request('GET');
      if (response.status === 404) return setState({ status: 'unavailable' });
      if (!response.ok) return setState({ status: 'error' });
      const body = (await response.json()) as { connections?: Connection[] };
      setState({ status: 'loaded', connections: body.connections ?? [] });
    } catch {
      setState({ status: 'error' });
    }
  }, [request]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const revoke = async (connectionId?: string) => {
    setRevoking(connectionId ?? 'all');
    try {
      const response = await request('DELETE', connectionId);
      if (!response.ok) throw new Error(`status ${response.status}`);
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
    setRevoking(null);
    await refresh();
  };

  const confirmRevoke = (connection?: Connection) =>
    modals.openConfirmModal({
      title: connection ? 'この接続を解除' : 'Claude との接続をすべて解除',
      children: (
        <Text size="sm">
          {(connection
            ? `${formatDateTime(connection.connectedAt)} に許可した接続を解除します。`
            : 'Claude から家計簿を読み取れないようにします。') +
            'すでに渡した通行証が切れるまで、最長1時間は読み取れることがあります。' +
            'もう一度使うときは、Claude のコネクタの画面から接続し直してください。'}
        </Text>
      ),
      labels: { confirm: '解除する', cancel: 'キャンセル' },
      confirmProps: { color: 'red' },
      onConfirm: () => void revoke(connection?.id),
    });

  if (state.status === 'unavailable') return null;
  const connections = state.status === 'loaded' ? state.connections : [];

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
          {state.status === 'loaded' && connections.length > 0 && (
            <Badge variant="light" color="teal" style={{ flexShrink: 0 }}>
              {connections.length > 1 ? `接続中 ${connections.length}件` : '接続中'}
            </Badge>
          )}
          {state.status === 'loaded' && connections.length === 0 && (
            <Badge variant="light" color="gray" style={{ flexShrink: 0 }}>未接続</Badge>
          )}
        </Group>

        {state.status === 'error' && (
          <Text size="xs" c="dimmed">
            接続の状態を確認できませんでした。時間をおいて開き直してください。
          </Text>
        )}

        {connections.length > 0 && (
          <>
            <Stack gap={0}>
              {connections.map((connection) => (
                <Group
                  key={connection.id}
                  justify="space-between"
                  wrap="nowrap"
                  gap="sm"
                  py="xs"
                  style={{ borderTop: '1px solid var(--hairline)' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm">{formatDateTime(connection.connectedAt)} に許可</Text>
                    <Text size="xs" c="dimmed">最後に使った時期: {formatDateTime(connection.lastActiveAt)}</Text>
                  </div>
                  <Button
                    variant="subtle"
                    color="red"
                    size="xs"
                    style={{ flexShrink: 0 }}
                    loading={revoking === connection.id}
                    disabled={revoking !== null && revoking !== connection.id}
                    onClick={() => confirmRevoke(connection)}
                  >
                    解除
                  </Button>
                </Group>
              ))}
            </Stack>

            <Text size="xs" c="dimmed">
              心当たりの無い接続があれば解除してください。パスワードを変えた場合も、それより前に許可した接続は1時間ほどで切れます。
            </Text>

            {connections.length > 1 && (
              <Group justify="flex-end">
                <Button
                  variant="light"
                  color="red"
                  size="xs"
                  leftSection={<IconPlugConnectedX size={14} />}
                  loading={revoking === 'all'}
                  disabled={revoking !== null && revoking !== 'all'}
                  onClick={() => confirmRevoke()}
                >
                  すべて解除
                </Button>
              </Group>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
};
