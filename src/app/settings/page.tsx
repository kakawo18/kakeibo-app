'use client';

/**
 * 設定ページ (/settings)
 *
 * カテゴリ・支払い方法・月間予算・定期取引などユーザーごとの設定を管理する。
 * 設定は Firestore の users/{uid}/settings/app に保存され、
 * ダッシュボードへリアルタイムに反映される。
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Stack,
  Box,
  Loader,
  Text,
  Paper,
  Group,
  Button,
} from '@mantine/core';
import { IconRepeat } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { BudgetSection } from '@/components/settings/BudgetSection';
import { CategorySection } from '@/components/settings/CategorySection';
import { PaymentMethodSection } from '@/components/settings/PaymentMethodSection';
import { RecurringTransactionManager } from '@/components/recurring/RecurringTransactionManager';

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { loading: settingsLoading } = useSettings();
  const [recurringManagerOpened, setRecurringManagerOpened] = useState(false);

  // 未ログインならダッシュボード(ログイン画面)へ
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  if (authLoading || settingsLoading || !user) {
    return (
      <Container size="sm" py={80}>
        <Stack align="center" gap="sm">
          <Loader size="sm" color="indigo" />
          <Text size="sm" c="dimmed">設定を読み込み中...</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <Box pb={40}>
      <SettingsHeader />
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
      </Container>

      <RecurringTransactionManager
        opened={recurringManagerOpened}
        onClose={() => setRecurringManagerOpened(false)}
      />
    </Box>
  );
}
