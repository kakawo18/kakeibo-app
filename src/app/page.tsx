'use client';

import { Suspense } from 'react';
import { Container, Text } from '@mantine/core';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/ui/LoginForm';
import { DashboardContent } from '@/components/ui/DashboardContent';
import { PWAInstaller } from '@/components/PWAInstaller';

function DashboardWrapper() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <Container size="md" py="xl">
        <Text ta="center">読み込み中...</Text>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container size="xs" py="xl">
        <LoginForm />
      </Container>
    );
  }

  return (
    <Suspense fallback={
      <Container size="xl" py="xl">
        <Text ta="center">データを読み込み中...</Text>
      </Container>
    }>
      <DashboardContent />
    </Suspense>
  );
}

export default function Home() {
  return (
    <>
      <DashboardWrapper />
      <PWAInstaller />
    </>
  );
}