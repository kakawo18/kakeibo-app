'use client';

import Link from 'next/link';
import { ActionIcon, Box, Container, Group, Text } from '@mantine/core';
import { IconChevronLeft } from '@tabler/icons-react';

/** 年間振り返りページのスティッキーヘッダー(戻るボタン+タイトル) */
export const ReviewHeader = () => (
  <Box className="app-header" mb="md">
    <Container size="lg">
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
          年間振り返り
        </Text>
      </Group>
    </Container>
  </Box>
);
