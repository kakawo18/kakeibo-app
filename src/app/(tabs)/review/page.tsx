'use client';

/**
 * 年間振り返りタブ (/review)
 *
 * 年収(額面/手取り)・支出・投資・貯蓄率を年単位で見返す画面。
 * 認証ガードとローディングは (tabs)/layout.tsx が持つ。
 * 表示する年は URL クエリ `?year=YYYY` に持つため、ReviewContent は Suspense で包む。
 */
import { Suspense } from 'react';
import { Container, Loader, Stack, Text } from '@mantine/core';
import { ReviewContent } from '@/components/review/ReviewContent';

export default function ReviewPage() {
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
      <ReviewContent />
    </Suspense>
  );
}
