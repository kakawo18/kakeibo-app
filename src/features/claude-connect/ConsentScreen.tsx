'use client';

/**
 * Claude との接続の同意画面（docs/claude-connector/仕様書.md 5.5）
 *
 * 表示する前の検証はページ（サーバー）が済ませている。「許可する」を押すと Firebase の ID トークンと
 * クエリをそのまま送り、返ってきた redirectTo（claude.ai のコールバック）へ移動する。
 * フォーム送信 + 302 にしないのは、CSP の form-action 'self' が送信後のリダイレクト先にも効くため。
 */
import { useState } from 'react';
import { Alert, Box, Button, Container, Group, List, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { IconCheck, IconLock } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { EmailVerificationGate, LoginForm } from '@/features/auth';

interface ConsentScreenProps {
  /** /oauth/authorize のクエリ（サーバーで検証済み）。そのままサーバーへ送り返す */
  query: Record<string, string>;
  /** 許可した後に戻る先のホスト名（claude.ai） */
  redirectHost: string;
  /** キャンセルしたときに戻る URL（error=access_denied 付き） */
  cancelUrl: string;
}

export const ConsentScreen: React.FC<ConsentScreenProps> = ({ query, redirectHost, cancelUrl }) => {
  const { user, verifiedUser, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <Container size="xs" py={80}>
        <Group justify="center">
          <Loader size="sm" color="indigo" />
        </Group>
      </Container>
    );
  }

  // ログインしたら同じ画面のまま同意に進む
  if (!user) return <LoginForm />;
  // 未確認のアカウントはサーバーでも拒否する（firebaseIdToken.ts の email_verified）
  if (!verifiedUser) return <EmailVerificationGate />;

  const approve = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, query }),
      });
      const body = (await response.json().catch(() => ({}))) as { redirectTo?: string };
      if (response.ok && body.redirectTo) {
        window.location.assign(body.redirectTo);
        return;
      }
      setError(
        response.status === 401
          ? 'ログインの確認に失敗しました。ログアウトしてログインし直してから、もう一度試してください。'
          : '接続を許可できませんでした。Claude の画面からもう一度接続し直してください。'
      );
    } catch {
      setError('通信に失敗しました。接続を確かめて、もう一度試してください。');
    }
    setSubmitting(false);
  };

  return (
    <Container size="xs" py={48} px="md">
      <Paper className="ledger-card" p={28}>
        <Stack gap="lg">
          <Stack gap={6}>
            <Group gap={8}>
              <IconLock size={20} stroke={1.8} color="var(--accent)" />
              <Title order={1} size="h3">Claude との接続</Title>
            </Group>
            <Text size="sm" c="dimmed">
              Claude が、この家計簿のデータを読み取ろうとしています。
            </Text>
          </Stack>

          <Box>
            <Text size="sm" fw={600} mb={6}>許可すると、Claude は次のことができます</Text>
            <List
              size="sm"
              spacing={4}
              icon={<IconCheck size={16} stroke={2} color="var(--income)" />}
            >
              <List.Item>取引の検索と、月・年ごとの集計の読み取り</List.Item>
              <List.Item>カテゴリ・支払方法・月間予算・定期取引の読み取り</List.Item>
            </List>
            <Text size="sm" c="dimmed" mt={8}>
              取引や設定の追加・変更・削除はできません。
            </Text>
          </Box>

          <Stack gap={4}>
            <Text size="sm">
              ログイン中: <Text span fw={600}>{user.email}</Text>
            </Text>
            <Text size="sm">
              許可した後の移動先: <Text span fw={600}>{redirectHost}</Text>
            </Text>
          </Stack>

          {error && (
            <Alert color="red" variant="light" radius="md">
              {error}
            </Alert>
          )}

          <Stack gap="xs">
            <Button size="md" onClick={approve} loading={submitting} fullWidth>
              許可する
            </Button>
            <Button
              size="md"
              variant="default"
              fullWidth
              disabled={submitting}
              onClick={() => window.location.assign(cancelUrl)}
            >
              キャンセル
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Container>
  );
};

/** 検証に失敗した（client_id や redirect_uri が違う）ときの画面。どこへも移動しない */
export const ConsentError: React.FC<{ message: string }> = ({ message }) => (
  <Container size="xs" py={48} px="md">
    <Paper className="ledger-card" p={28}>
      <Stack gap="sm">
        <Title order={1} size="h3">接続できません</Title>
        <Text size="sm">{message}</Text>
        <Text size="sm" c="dimmed">
          Claude の画面に戻り、コネクタの URL と OAuth の Client ID が正しいか確かめてください。
        </Text>
      </Stack>
    </Paper>
  </Container>
);
