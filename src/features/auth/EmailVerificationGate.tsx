'use client';

/**
 * メールアドレスの確認を求める画面（#164）
 *
 * ログインしていても、メールアドレスを確認するまで家計簿は使えない（firestore.rules が
 * email_verified を要求する）。メールのリンクによる登録では最初から確認済みになるので、
 * ここに来るのは主に、確認の仕組みを入れる前にパスワードで登録したアカウント。
 *
 * 確認のリンクは Firebase の画面で開く（ホーム画面のアプリからでもブラウザで開く）ので、
 * アプリに戻ったときに状態を読み直す。
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Container, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconMailCheck } from '@tabler/icons-react';
import { FirebaseError } from 'firebase/app';
import { sendEmailVerification } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';

const errorCode = (error: unknown): string | null => (error instanceof FirebaseError ? error.code : null);

const sendErrorMessage = (error: unknown): string => {
  const code = errorCode(error);
  if (code === 'auth/too-many-requests') {
    return '送信が続いたため、しばらく送れません。時間をおいてからお試しください。';
  }
  if (code === 'auth/user-token-expired' || code === 'auth/user-disabled' || code === 'auth/invalid-user-token') {
    return 'ログインの有効期限が切れています。ログアウトして、ログインし直してください。';
  }
  // 原因を問い合わせで特定できるよう、コードを添える（家計データは含まない）
  return `確認メールを送れませんでした。通信状態を確かめて、もう一度お試しください。${code ? `（${code}）` : ''}`;
};

/** 戻り先の URL が許可されていない（Firebase の承認済みドメインに無い）ときのエラー */
const CONTINUE_URL_ERRORS = ['auth/unauthorized-continue-uri', 'auth/invalid-continue-uri'];

export const EmailVerificationGate: React.FC = () => {
  const { user, refreshEmailVerification, logout } = useAuth();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<{ color: 'red' | 'yellow'; text: string } | null>(null);

  const check = useCallback(
    async (silent: boolean) => {
      setChecking(true);
      try {
        const verified = await refreshEmailVerification();
        if (!verified && !silent) {
          setMessage({
            color: 'yellow',
            text: 'まだ確認できていません。メールのリンクを開いてから、もう一度押してください。',
          });
        }
      } catch {
        if (!silent) setMessage({ color: 'red', text: '状態を確かめられませんでした。通信状態を確かめてください。' });
      } finally {
        setChecking(false);
      }
    },
    [refreshEmailVerification]
  );

  // 確認のリンクを開いてアプリ（タブ）に戻ってきたら、自動で読み直す
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [check]);

  if (!user) return null;

  const send = async () => {
    setSending(true);
    setMessage(null);
    try {
      try {
        await sendEmailVerification(user, { url: window.location.origin });
      } catch (error) {
        // 戻り先のリンクが付けられなくても、確認そのものはできるので付けずに送り直す
        if (!CONTINUE_URL_ERRORS.includes(errorCode(error) ?? '')) throw error;
        await sendEmailVerification(user);
      }
      setSent(true);
    } catch (error) {
      setMessage({ color: 'red', text: sendErrorMessage(error) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Container size="xs" py={60}>
      <Paper className="ledger-card" p={30}>
        <Stack gap="md">
          <Title order={2} size="h3" ta="center">
            メールアドレスの確認
          </Title>
          <Text size="sm">
            家計簿を使うには、メールアドレス（{user.email}）の確認が必要です。確認のメールを送り、届いたメールのリンクを開いてください。
          </Text>

          {sent && (
            <Alert color="indigo" variant="light" radius="md" icon={<IconMailCheck size={18} />}>
              <Text size="sm">確認のメールを送りました。リンクを開いたら、この画面に戻って「確認した」を押してください。</Text>
              <Text size="xs" c="dimmed" mt={6}>
                届かない場合は、迷惑メールのフォルダを確かめてください。
              </Text>
            </Alert>
          )}

          {message && (
            <Alert color={message.color} variant="light" radius="md">
              {message.text}
            </Alert>
          )}

          <Button onClick={() => void send()} loading={sending} variant={sent ? 'default' : 'filled'} fullWidth>
            {sent ? '確認メールをもう一度送る' : '確認メールを送る'}
          </Button>
          {/* 別の端末で確認を済ませた場合にも使えるよう、送信前から出しておく */}
          <Button
            onClick={() => void check(false)}
            loading={checking}
            variant={sent ? 'filled' : 'default'}
            fullWidth
          >
            確認した
          </Button>
          <Group justify="center">
            <Button variant="subtle" color="gray" size="sm" onClick={() => void logout()}>
              ログアウト
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Container>
  );
};
