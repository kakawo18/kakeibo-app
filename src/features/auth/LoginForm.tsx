'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, TextInput, Stack, Paper, Title, Text, Alert, PasswordInput, Container, Group, Box } from '@mantine/core';
import { useForm } from '@mantine/form';
import { signInWithEmailAndPassword, sendSignInLinkToEmail } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/lib/firebase';
import { IconMail, IconLock, IconMailCheck } from '@tabler/icons-react';
import { emailLinkSettings, rememberEmailForSignIn } from './emailLink';

/**
 * ユーザー入力起因で発生しうる既知の認証エラーコードとユーザー向けメッセージ。
 * ここにあるコードは正常系として扱い、コンソールにエラー出力しない
 * （Next.js の dev オーバーレイが console.error をエラー表示するため）
 */
const KNOWN_AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'メールアドレスの形式が正しくありません。',
  'auth/too-many-requests': '試行回数が多すぎます。しばらく時間をおいてお試しください。',
  'auth/network-request-failed': 'ネットワークエラーが発生しました。接続を確認してください。',
  // 「未登録」と「パスワード違い」は区別しない。
  // 区別すると、任意のメールアドレスが登録済みかを外部から判定できてしまう（アカウント列挙）。
  'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません。',
  'auth/user-not-found': 'メールアドレスまたはパスワードが正しくありません。',
  'auth/wrong-password': 'メールアドレスまたはパスワードが正しくありません。',
};

const isKnownAuthError = (error: unknown): error is FirebaseError =>
  error instanceof FirebaseError && error.code in KNOWN_AUTH_ERROR_MESSAGES;

/** Firebaseの認証エラーコードをユーザー向けメッセージに変換する */
const getAuthErrorMessage = (error: unknown): string => {
  if (isKnownAuthError(error)) {
    return KNOWN_AUTH_ERROR_MESSAGES[error.code];
  }
  return 'エラーが発生しました。もう一度お試しください。';
};

interface LoginFormProps {
  onSuccess?: () => void;
}

/**
 * login: メールアドレスとパスワードでログイン
 * signup / reset: メールアドレスに確認のリンクを送る（#164 / #165）。
 * 新規登録とパスワードの再設定は同じ手順で、リンクを開いた先でパスワードを設定する。
 * 登録済みかどうかで応答を変えないため、どちらも送信後は同じ表示にする
 */
type Mode = 'login' | 'signup' | 'reset';

const TITLES: Record<Mode, string> = {
  login: 'ログイン',
  signup: 'アカウント作成',
  reset: 'パスワードの再設定',
};

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** リンクを送ったアドレス。送信後の表示に使う */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const isLogin = mode === 'login';
  const emailInputRef = useRef<HTMLInputElement>(null);

  // PWA環境での初期フォーカス問題を解決
  useEffect(() => {
    // PWA環境でのフォーカス遅延
    const timer = setTimeout(() => {
      if (emailInputRef.current) {
        emailInputRef.current.focus();
      }
    }, 100);

    // PWA環境での強制入力有効化（CSSクラスとの併用）
    const enablePWAInput = () => {
      const inputs = document.querySelectorAll('[data-testid="email-input"] input, [data-testid="password-input"] input');
      inputs.forEach((input) => {
        const htmlInput = input as HTMLInputElement;

        // PWA環境での特別処理（イベントリスナーのみJSで制御）
        if (typeof window !== 'undefined') {
          const isStandalone = 'standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone;
          if (isStandalone || window.matchMedia('(display-mode: standalone)').matches) {
            htmlInput.addEventListener('touchstart', () => {
              // e.preventDefault(); // preventDefaultはスクロールを阻害する場合があるため慎重に
              htmlInput.focus();
            }, { passive: true });

            htmlInput.addEventListener('click', (e) => {
              e.stopPropagation();
              htmlInput.focus();
            });
          }
        }
      });
    };

    // DOM読み込み後に実行
    const domTimer = setTimeout(enablePWAInput, 200);

    return () => {
      clearTimeout(timer);
      clearTimeout(domTimer);
    };
  }, []);

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) =>
        /^\S+@\S+$/.test(value) ? null : 'メールアドレスの形式が正しくありません',
    },
  });

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setSentTo(null);
  };

  const handleSubmit = async (values: { email: string; password: string }) => {
    // 既存アカウントは6文字で作られている可能性があるため、ログイン時は6文字で弾く。
    // 新規登録・再設定ではパスワードを入れない（リンクを開いた先で設定する）
    if (isLogin && values.password.length < 6) {
      form.setFieldError('password', 'パスワードは6文字以上で入力してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, values.email, values.password);
        onSuccess?.();
      } else {
        const email = values.email.trim();
        await sendSignInLinkToEmail(auth, email, emailLinkSettings(window.location.origin));
        rememberEmailForSignIn(email);
        setSentTo(email);
      }
    } catch (error) {
      if (!isKnownAuthError(error)) {
        console.error(error);
      }
      setError(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xs" my={60}>
      <Stack align="center" mb="lg" gap={8}>
        <Group gap={10}>
          <Box
            w={36}
            h={36}
            style={{
              borderRadius: 10,
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            ¥
          </Box>
          <Title order={1} size="h2" style={{ letterSpacing: '-0.02em' }}>
            家計簿
          </Title>
        </Group>
        <Text c="dimmed" size="sm">
          シンプルで使いやすい家計簿アプリ
        </Text>
      </Stack>

      <Paper
        className="ledger-card"
        p={30}
      >
        <Title order={2} ta="center" mb="md" size="h3">
          {TITLES[mode]}
        </Title>

        {error && (
          <Alert color="red" mb="md" variant="light" radius="md">
            {error}
          </Alert>
        )}

        {sentTo ? (
          <Stack gap="md">
            <Alert color="indigo" variant="light" radius="md" icon={<IconMailCheck size={18} />}>
              <Text size="sm">
                {sentTo} に確認のメールを送りました。メールのリンクを開いて、パスワードを設定してください。
              </Text>
              <Text size="xs" c="dimmed" mt={6}>
                届かない場合は、迷惑メールのフォルダとアドレスの綴りを確かめてください。
              </Text>
            </Alert>
            <Button variant="default" fullWidth onClick={() => switchMode('login')}>
              ログイン画面に戻る
            </Button>
          </Stack>
        ) : (
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <TextInput
                ref={emailInputRef}
                label="メールアドレス"
                placeholder="hello@example.com"
                required
                {...form.getInputProps('email')}
                leftSection={<IconMail size={16} />}
                data-testid="email-input"
                inputMode="email"
              />

              {isLogin ? (
                <PasswordInput
                  label="パスワード"
                  placeholder="パスワード"
                  required
                  {...form.getInputProps('password')}
                  leftSection={<IconLock size={16} />}
                  data-testid="password-input"
                />
              ) : (
                <Text size="sm" c="dimmed">
                  このアドレスに確認のメールを送ります。メールのリンクを開くと、パスワードを設定できます。
                </Text>
              )}

              <Button
                type="submit"
                loading={loading}
                fullWidth
                size="md"
              >
                {isLogin ? 'ログイン' : '確認メールを送る'}
              </Button>
            </Stack>
          </form>
        )}

        {isLogin ? (
          <Stack align="center" mt="xl" gap={4}>
            <Group justify="center" gap="xs">
              <Text size="sm" c="dimmed">
                アカウントをお持ちでない方は
              </Text>
              <Button variant="subtle" size="sm" onClick={() => switchMode('signup')}>
                新規登録
              </Button>
            </Group>
            <Button variant="subtle" size="sm" color="gray" onClick={() => switchMode('reset')}>
              パスワードを忘れた場合
            </Button>
          </Stack>
        ) : sentTo ? null : (
          <Group justify="center" mt="xl" gap="xs">
            <Text size="sm" c="dimmed">
              すでにアカウントをお持ちの方は
            </Text>
            <Button variant="subtle" size="sm" onClick={() => switchMode('login')}>
              ログイン
            </Button>
          </Group>
        )}
      </Paper>
    </Container>
  );
};