'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, TextInput, Stack, Paper, Title, Text, Alert, PasswordInput, Container, Group, Box } from '@mantine/core';
import { useForm } from '@mantine/form';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/lib/firebase';
import { IconMail, IconLock } from '@tabler/icons-react';

/**
 * ユーザー入力起因で発生しうる既知の認証エラーコードとユーザー向けメッセージ。
 * ここにあるコードは正常系として扱い、コンソールにエラー出力しない
 * （Next.js の dev オーバーレイが console.error をエラー表示するため）
 */
const KNOWN_AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'このメールアドレスは既に登録されています。ログインをお試しください。',
  'auth/invalid-email': 'メールアドレスの形式が正しくありません。',
  'auth/weak-password': 'パスワードが弱すぎます。6文字以上で設定してください。',
  'auth/too-many-requests': '試行回数が多すぎます。しばらく時間をおいてお試しください。',
  'auth/network-request-failed': 'ネットワークエラーが発生しました。接続を確認してください。',
  // 「未登録」と「パスワード違い」は区別しない。
  // 区別すると、任意のメールアドレスが登録済みかを外部から判定できてしまう（アカウント列挙）。
  'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません。',
  'auth/user-not-found': 'メールアドレスまたはパスワードが正しくありません。',
  'auth/wrong-password': 'メールアドレスまたはパスワードが正しくありません。',
};

/** 新規登録時に要求するパスワードの最小文字数（Firebase の既定は6文字） */
const MIN_SIGNUP_PASSWORD_LENGTH = 10;

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

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      // 既存アカウントは6文字で作られている可能性があるため、ログイン時はここで弾かない。
      // 新規登録時の下限は handleSubmit で別途チェックする。
      password: (value) => (value.length < 6 ? 'パスワードは6文字以上で入力してください' : null),
    },
  });

  const handleSubmit = async (values: { email: string; password: string }) => {
    // 新規登録時のみ、より長いパスワードを要求する
    if (!isLogin && values.password.length < MIN_SIGNUP_PASSWORD_LENGTH) {
      setError(`パスワードは${MIN_SIGNUP_PASSWORD_LENGTH}文字以上で設定してください。`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, values.email, values.password);
      } else {
        await createUserWithEmailAndPassword(auth, values.email, values.password);
      }
      onSuccess?.();
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
          {isLogin ? 'ログイン' : 'アカウント作成'}
        </Title>

        {error && (
          <Alert color="red" mb="md" variant="light" radius="md">
            {error}
          </Alert>
        )}

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

            <PasswordInput
              label="パスワード"
              placeholder={isLogin ? 'パスワード' : `パスワード（${MIN_SIGNUP_PASSWORD_LENGTH}文字以上）`}
              required
              {...form.getInputProps('password')}
              leftSection={<IconLock size={16} />}
              data-testid="password-input"
            />

            <Button
              type="submit"
              loading={loading}
              fullWidth
              size="md"
            >
              {isLogin ? 'ログイン' : '登録する'}
            </Button>
          </Stack>
        </form>

        <Group justify="center" mt="xl" gap="xs">
          <Text size="sm" c="dimmed">
            {isLogin ? 'アカウントをお持ちでない方は' : 'すでにアカウントをお持ちの方は'}
          </Text>
          <Button
            variant="subtle"
            size="sm"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? '新規登録' : 'ログイン'}
          </Button>
        </Group>
      </Paper>
    </Container>
  );
};