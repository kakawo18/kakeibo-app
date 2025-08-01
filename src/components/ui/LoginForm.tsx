'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, TextInput, Stack, Paper, Title, Text, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

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

    // PWA環境での強制入力有効化
    const enablePWAInput = () => {
      const inputs = document.querySelectorAll('[data-testid="email-input"] input, [data-testid="password-input"] input');
      inputs.forEach((input) => {
        const htmlInput = input as HTMLInputElement;
        
        // 強制的に入力可能にする
        htmlInput.readOnly = false;
        htmlInput.disabled = false;
        htmlInput.style.pointerEvents = 'auto';
        htmlInput.style.userSelect = 'text';
        htmlInput.style.setProperty('-webkit-user-select', 'text');
        htmlInput.style.setProperty('-webkit-touch-callout', 'default');
        htmlInput.style.setProperty('touch-action', 'manipulation');
        
        // PWA環境での特別処理
        if (typeof window !== 'undefined') {
          const isStandalone = 'standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone;
          if (isStandalone || window.matchMedia('(display-mode: standalone)').matches) {
            htmlInput.addEventListener('touchstart', (e) => {
              e.preventDefault();
              htmlInput.focus();
              // キーボードを強制表示
              htmlInput.click();
            }, { passive: false });
            
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
      setError(error instanceof Error ? error.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper withBorder shadow="md" p={30} mt={30} radius="md">
      <Title order={2} ta="center" mb="md">
        {isLogin ? 'ログイン' : 'アカウント作成'}
      </Title>

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <TextInput
            ref={emailInputRef}
            label="メールアドレス"
            placeholder="your-email@example.com"
            required
            {...form.getInputProps('email')}
            styles={{
              input: {
                fontSize: '16px !important', // PWA自動ズーム防止
                WebkitUserSelect: 'text !important',
                WebkitTouchCallout: 'default !important',
                touchAction: 'manipulation !important',
                WebkitAppearance: 'none !important',
                appearance: 'none !important',
                transform: 'translateZ(0)',
                WebkitTransform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                outline: 'none',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                padding: '8px 12px',
                backgroundColor: '#ffffff !important',
                color: '#000000 !important',
              } as any // PWA対応のため!importantが必要
            }}
            inputMode="email"
            autoComplete="email"
            data-testid="email-input"
            onTouchStart={(e) => {
              // PWA環境でのタッチ開始時の処理
              e.currentTarget.focus();
            }}
            onFocus={(e) => {
              // フォーカス時の強制処理
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.color = '#000000';
            }}
          />

          <TextInput
            label="パスワード"
            placeholder="パスワード（6文字以上）"
            type="password"
            required
            {...form.getInputProps('password')}
            styles={{
              input: {
                fontSize: '16px !important', // PWA自動ズーム防止
                WebkitUserSelect: 'text !important',
                WebkitTouchCallout: 'default !important',
                touchAction: 'manipulation !important',
                WebkitAppearance: 'none !important',
                appearance: 'none !important',
                transform: 'translateZ(0)',
                WebkitTransform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                outline: 'none',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                padding: '8px 12px',
                backgroundColor: '#ffffff !important',
                color: '#000000 !important',
              } as any // PWA対応のため!importantが必要
            }}
            autoComplete="current-password"
            data-testid="password-input"
            onTouchStart={(e) => {
              // PWA環境でのタッチ開始時の処理
              e.currentTarget.focus();
            }}
            onFocus={(e) => {
              // フォーカス時の強制処理
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.color = '#000000';
            }}
          />

          <Button type="submit" loading={loading} fullWidth>
            {isLogin ? 'ログイン' : 'アカウント作成'}
          </Button>
        </Stack>
      </form>

      <Text ta="center" mt="md">
        {isLogin ? 'アカウントをお持ちでない方は' : 'すでにアカウントをお持ちの方は'}
        <Text
          component="button"
          type="button"
          c="blue"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? 'こちら' : 'ログイン'}
        </Text>
      </Text>
    </Paper>
  );
};