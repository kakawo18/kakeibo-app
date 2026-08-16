'use client';

import { Text, Group, Badge, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import packageJson from '../../../package.json';

/** 開発元 */
const COMPANY_NAME = 'Gorillaburg Inc.';

export const VersionDisplay: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <Stack gap={4} align="center" py={isMobile ? 8 : 12}>
      <Group gap="xs">
        <Text size={isMobile ? 'xs' : 'sm'} c="dimmed">
          家計簿アプリ
        </Text>
        <Badge size={isMobile ? 'xs' : 'sm'} variant="light" color="blue">
          v{packageJson.version}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed">
        © {COMPANY_NAME}
      </Text>
    </Stack>
  );
};
