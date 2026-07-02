'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, TextInput, Stack, Paper, Title, Text, Alert, PasswordInput, Container, Group, Box } from '@mantine/core';
import { useForm } from '@mantine/form';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { IconMail, IconLock } from '@tabler/icons-react';

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
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      password: (value) => (value.length < 6 ? 'Password must be at least 6 characters' : null),
    },
  });

  const handleSubmit = async (values: { email: string; password: string }) => {
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
      console.error(error);
      setError('メールアドレスまたはパスワードが正しくありません。');
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
              background: 'linear-gradient(135deg, var(--mantine-color-indigo-6), var(--mantine-color-cyan-5))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 800,
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
              placeholder="パスワード（6文字以上）"
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
              radius="xl"
              variant="gradient"
              gradient={{ from: 'indigo', to: 'cyan', deg: 135 }}
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
            color="blue"
          >
            {isLogin ? '新規登録' : 'ログイン'}
          </Button>
        </Group>
      </Paper>
    </Container>
  );
};