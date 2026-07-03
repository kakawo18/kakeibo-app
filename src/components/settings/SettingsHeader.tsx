'use client';

import Link from 'next/link';
import { Box, Container, Group, ActionIcon, Text } from '@mantine/core';
import { IconChevronLeft } from '@tabler/icons-react';

/** 設定ページのスティッキーヘッダー(戻るボタン+タイトル) */
export const SettingsHeader = () => (
  <Box className="app-header" mb="md">
    <Container size="sm">
      <Group h={56} gap={8}>
        <ActionIcon
          component={Link}
          href="/"
          variant="subtle"
          color="gray"
          size="lg"
          aria-label="ダッシュボードに戻る"
        >
          <IconChevronLeft size={20} />
        </ActionIcon>
        <Text fw={700} size="md" style={{ letterSpacing: '-0.01em' }}>
          設定
        </Text>
      </Group>
    </Container>
  </Box>
);
