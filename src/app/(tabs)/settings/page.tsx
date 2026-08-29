'use client';

/**
 * 設定タブ (/settings)
 *
 * カテゴリ・支払い方法・月間予算・定期取引などユーザーごとの設定を管理する。
 * 設定は Firestore の users/{uid}/settings/app に保存され、他のタブへリアルタイムに反映される。
 * 認証ガードとローディングは (tabs)/layout.tsx が持つ。
 */
import { useState } from 'react';
import { Button, Container, Group, Paper, Stack, Text } from '@mantine/core';
import { IconRepeat } from '@tabler/icons-react';
import { BudgetSection } from '@/components/settings/BudgetSection';
import { CategorySection } from '@/components/settings/CategorySection';
import { PaymentMethodSection } from '@/components/settings/PaymentMethodSection';
import { RecurringTransactionManager } from '@/components/recurring/RecurringTransactionManager';

export default function SettingsPage() {
  const [recurringManagerOpened, setRecurringManagerOpened] = useState(false);

  return (
    <Container size="sm">
      <Stack gap="md">
        <BudgetSection />
        <CategorySection />
        <PaymentMethodSection />

        {/* 定期取引(既存の管理モーダルへの導線) */}
        <Paper className="ledger-card" p="lg">
          <Group justify="space-between" align="center">
            <div>
              <Text className="section-title" mb={4}>定期取引</Text>
              <Text size="xs" c="dimmed">
                家賃やサブスクなど毎月自動で記録する取引を管理します
              </Text>
            </div>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconRepeat size={14} />}
              onClick={() => setRecurringManagerOpened(true)}
            >
              管理
            </Button>
          </Group>
        </Paper>
      </Stack>

      <RecurringTransactionManager
        opened={recurringManagerOpened}
        onClose={() => setRecurringManagerOpened(false)}
      />
    </Container>
  );
}
