'use client';

/**
 * 確認メールのリンクを開いたときの画面（#164 / #165）
 *
 * リンクでログインし（新しいアドレスならここでアカウントができる）、続けてパスワードを設定する。
 * 新規登録とパスワードの再設定は同じ手順。どちらもリンクを開いた時点でメールアドレスは確認済みになる。
 *
 * 登録済みのアカウントでもパスワードを設定し直させる。確認の仕組みを入れる前に他人が
 * このアドレスで登録していた場合、そのパスワードを無効にして本来の持ち主が取り戻せるようにするため
 * （パスワードを変えると、ほかの端末のログインも切れる）。
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Container, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconLock, IconMail } from '@tabler/icons-react';
import { FirebaseError } from 'firebase/app';
import { isSignInWithEmailLink, signInWithEmailLink, updatePassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  EMAIL_LINK_PATH,
  MIN_PASSWORD_LENGTH,
  forgetEmailForSignIn,
  recallEmailForSignIn,
} from './emailLink';

type Step =
  | { kind: 'checking' }
  | { kind: 'invalid' }
  | { kind: 'needEmail' }
  | { kind: 'signingIn' }
  | { kind: 'failed'; message: string }
  | { kind: 'setPassword' }
  | { kind: 'done' };

const signInErrorMessage = (error: unknown): string => {
  const code = error instanceof FirebaseError ? error.code : '';
  if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') {
    return 'このリンクは使えません（使用済みか、期限切れです）。ログイン画面から、もう一度確認メールを送ってください。';
  }
  if (code === 'auth/invalid-email') {
    return 'メールアドレスが、リンクを送ったアドレスと一致しません。';
  }
  if (code === 'auth/network-request-failed') {
    return 'ネットワークエラーが発生しました。接続を確認して、もう一度リンクを開いてください。';
  }
  return 'ログインできませんでした。ログイン画面から、もう一度確認メールを送ってください。';
};

const passwordErrorMessage = (error: unknown): string => {
  const code = error instanceof FirebaseError ? error.code : '';
  if (code === 'auth/weak-password') return 'パスワードが弱すぎます。別のパスワードにしてください。';
  if (code === 'auth/network-request-failed') return 'ネットワークエラーが発生しました。接続を確認してください。';
  if (code === 'auth/requires-recent-login') {
    return 'ログインから時間が経ったため設定できませんでした。もう一度確認メールを送ってやり直してください。';
  }
  return 'パスワードを設定できませんでした。もう一度お試しください。';
};

export const EmailLinkCompletion: React.FC = () => {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: 'checking' });
  const [link, setLink] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // 開発時の StrictMode で effect が2回走っても、同じリンクで2回ログインしない（2回目は使用済みで失敗する）
  const startedRef = useRef(false);

  const signIn = async (email: string, href: string) => {
    setStep({ kind: 'signingIn' });
    try {
      await signInWithEmailLink(auth, email, href);
      forgetEmailForSignIn();
      // 使い終わったリンク（oobCode）をアドレスバーと履歴に残さない
      window.history.replaceState(null, '', EMAIL_LINK_PATH);
      setStep({ kind: 'setPassword' });
    } catch (error) {
      setStep({ kind: 'failed', message: signInErrorMessage(error) });
    }
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const href = window.location.href;
    if (!isSignInWithEmailLink(auth, href)) {
      setStep({ kind: 'invalid' });
      return;
    }
    setLink(href);
    // 別の端末やブラウザ（ホーム画面のアプリから送って、メールアプリからブラウザで開いた場合など）では
    // 送り先を覚えていないので、入れてもらう
    const email = recallEmailForSignIn();
    if (email) void signIn(email, href);
    else setStep({ kind: 'needEmail' });
  }, []);

  const emailForm = useForm({
    initialValues: { email: '' },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value.trim()) ? null : 'メールアドレスの形式が正しくありません'),
    },
  });

  const passwordForm = useForm({
    initialValues: { password: '', confirm: '' },
    validate: {
      password: (value) =>
        value.length < MIN_PASSWORD_LENGTH ? `パスワードは${MIN_PASSWORD_LENGTH}文字以上で設定してください` : null,
      confirm: (value, values) => (value === values.password ? null : 'パスワードが一致しません'),
    },
  });

  const savePassword = async ({ password }: { password: string }) => {
    const user = auth.currentUser;
    if (!user) {
      setStep({ kind: 'failed', message: 'ログインが切れました。ログイン画面から、もう一度確認メールを送ってください。' });
      return;
    }
    setSaving(true);
    setPasswordError(null);
    try {
      await updatePassword(user, password);
      setStep({ kind: 'done' });
    } catch (error) {
      setPasswordError(passwordErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toTop = () => router.replace('/');

  const body = (() => {
    switch (step.kind) {
      case 'checking':
      case 'signingIn':
        return <Text size="sm" c="dimmed" ta="center">確認しています...</Text>;
      case 'invalid':
        return (
          <Stack gap="md">
            <Text size="sm">確認のリンクが正しくありません。メールのリンクをそのまま開いてください。</Text>
            <Button variant="default" onClick={toTop}>ログイン画面へ</Button>
          </Stack>
        );
      case 'needEmail':
        return (
          <form
            onSubmit={emailForm.onSubmit(({ email }) => {
              if (link) void signIn(email.trim(), link);
            })}
          >
            <Stack gap="md">
              <Text size="sm">確認のため、メールを受け取ったアドレスを入力してください。</Text>
              <TextInput
                label="メールアドレス"
                placeholder="hello@example.com"
                required
                inputMode="email"
                leftSection={<IconMail size={16} />}
                {...emailForm.getInputProps('email')}
              />
              <Button type="submit" fullWidth>続ける</Button>
            </Stack>
          </form>
        );
      case 'failed':
        return (
          <Stack gap="md">
            <Alert color="red" variant="light" radius="md">{step.message}</Alert>
            <Button variant="default" onClick={toTop}>ログイン画面へ</Button>
          </Stack>
        );
      case 'setPassword':
        return (
          <form onSubmit={passwordForm.onSubmit(savePassword)}>
            <Stack gap="md">
              <Text size="sm">
                メールアドレスを確認しました（{auth.currentUser?.email}）。次回からのログインに使うパスワードを設定してください。
              </Text>
              {passwordError && <Alert color="red" variant="light" radius="md">{passwordError}</Alert>}
              <PasswordInput
                label="パスワード"
                placeholder={`${MIN_PASSWORD_LENGTH}文字以上`}
                required
                leftSection={<IconLock size={16} />}
                {...passwordForm.getInputProps('password')}
              />
              <PasswordInput
                label="パスワード（確認）"
                required
                leftSection={<IconLock size={16} />}
                {...passwordForm.getInputProps('confirm')}
              />
              <Button type="submit" loading={saving} fullWidth>パスワードを設定する</Button>
            </Stack>
          </form>
        );
      case 'done':
        return (
          <Stack gap="md">
            <Alert color="indigo" variant="light" radius="md">
              <Text size="sm">パスワードを設定しました。</Text>
              <Text size="xs" c="dimmed" mt={6}>
                ホーム画面に追加したアプリで使っている場合は、アプリを開いて、このパスワードでログインしてください。
              </Text>
            </Alert>
            <Button onClick={toTop} fullWidth>家計簿を開く</Button>
          </Stack>
        );
    }
  })();

  return (
    <Container size="xs" py={60}>
      <Paper className="ledger-card" p={30}>
        <Title order={2} size="h3" ta="center" mb="md">
          {step.kind === 'setPassword' || step.kind === 'done' ? 'パスワードの設定' : 'メールアドレスの確認'}
        </Title>
        {body}
      </Paper>
    </Container>
  );
};
