'use client';

import { useState } from 'react';
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
            label="メールアドレス"
            placeholder="your-email@example.com"
            required
            {...form.getInputProps('email')}
          />

          <TextInput
            label="パスワード"
            placeholder="パスワード（6文字以上）"
            type="password"
            required
            {...form.getInputProps('password')}
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