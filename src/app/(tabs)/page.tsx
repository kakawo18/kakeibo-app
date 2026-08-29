'use client';

/**
 * ホームタブ (/)
 *
 * 選択中の月の収支・KPI・チャートを見る画面。
 * 認証ガードとローディングは (tabs)/layout.tsx が持つ。
 * DashboardContent は useSearchParams を使うため Suspense で包む。
 */
import { Suspense } from 'react';
import { Container, Loader, Stack, Text } from '@mantine/core';
import { DashboardContent } from '@/components/ui/DashboardContent';

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <Container size="lg" py={80}>
          <Stack align="center" gap="sm">
            <Loader size="sm" color="indigo" />
            <Text size="sm" c="dimmed">データを読み込み中...</Text>
          </Stack>
        </Container>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
