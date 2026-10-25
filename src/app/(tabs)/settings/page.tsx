'use client';

/**
 * 設定タブ (/settings)
 *
 * 定期取引・カテゴリ・支払い方法・月間予算などユーザーごとの設定を管理する。
 * 設定は Firestore の users/{uid}/settings/app に保存され、他のタブへリアルタイムに反映される。
 * 上部の定期取引では、毎月の合計と内訳を確かめて管理画面を開ける。
 * 認証ガードとローディングは (tabs)/layout.tsx が持つ。
 */
import { Container, Stack } from '@mantine/core';
import { BudgetSection } from '@/features/settings';
import { CategorySection } from '@/features/settings';
import { PaymentMethodSection } from '@/features/settings';
import { RecurringSummarySection } from '@/features/recurring';
import { ClaudeConnectionSection } from '@/features/claude-connect';

export default function SettingsPage() {
  return (
    <Container size="sm">
      <Stack gap="md">
        <RecurringSummarySection />
        <BudgetSection />
        <CategorySection />
        <PaymentMethodSection />
        <ClaudeConnectionSection />
      </Stack>
    </Container>
  );
}
