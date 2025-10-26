'use client';

import { Text, Group, Badge } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import packageJson from '../../../package.json';

export const VersionDisplay: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  return (
    <Group gap="xs" justify="center" style={{ padding: isMobile ? '8px' : '12px' }}>
      <Text size={isMobile ? "xs" : "sm"} c="dimmed">
        家計簿アプリ
      </Text>
      <Badge size={isMobile ? "xs" : "sm"} variant="light" color="blue">
        v{packageJson.version}
      </Badge>
    </Group>
  );
};
