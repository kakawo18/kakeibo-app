'use client';

import { useState } from 'react';
import {
  Modal,
  Button,
  Card,
  Stack,
  Group,
  Text,
  Badge,
  Divider,
  ActionIcon,
  Center,
  Loader,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { 
  IconTemplate, 
  IconCash, 
  IconCreditCard, 
  IconPlus,
  IconTrash,
  IconClock,
  IconTrendingUp
} from '@tabler/icons-react';
import { useTransactionTemplates } from '@/hooks/useTransactionTemplates';
import { TransactionTemplate } from '@/types';
import { notifications } from '@mantine/notifications';

interface TemplateSelectorProps {
  opened: boolean;
  onClose: () => void;
  onSelectTemplate: (template: TransactionTemplate) => void;
  onCreateTemplate: () => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  opened,
  onClose,
  onSelectTemplate,
  onCreateTemplate,
}) => {
  const { 
    templates, 
    loading, 
    error, 
    useTemplate: applyTemplate, 
    deleteTemplate,
    getPopularTemplates,
    getRecentTemplates 
  } = useTransactionTemplates();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const handleTemplateSelect = async (template: TransactionTemplate) => {
    try {
      await applyTemplate(template.id);
      onSelectTemplate(template);
      onClose();
    } catch (error) {
      console.error('Error using template:', error);
      notifications.show({
        title: 'エラー',
        message: 'テンプレートの使用に失敗しました',
        color: 'red',
      });
    }
  };

  const handleTemplateDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    
    setDeletingId(id);
    try {
      await deleteTemplate(id);
      notifications.show({
        title: '成功',
        message: 'テンプレートを削除しました',
        color: 'green',
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      notifications.show({
        title: 'エラー',
        message: 'テンプレートの削除に失敗しました',
        color: 'red',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getPaymentIcon = (paymentMethod?: string) => {
    return paymentMethod === '現金' ? <IconCash size={16} /> : <IconCreditCard size={16} />;
  };

  const getTypeColor = (type: 'income' | 'expense') => {
    return type === 'income' ? 'green' : 'red';
  };

  const formatLastUsed = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return '今日';
    if (days === 1) return '昨日';
    if (days < 7) return `${days}日前`;
    if (days < 30) return `${Math.floor(days / 7)}週間前`;
    return `${Math.floor(days / 30)}ヶ月前`;
  };

  const popularTemplates = getPopularTemplates(3);
  const recentTemplates = getRecentTemplates(3);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="テンプレート選択"
      size={isMobile ? 'full' : 'lg'}
      fullScreen={isMobile}
      radius={isMobile ? 0 : undefined}
    >
      {loading ? (
        <Center py="xl">
          <Loader size="md" />
        </Center>
      ) : error ? (
        <Center py="xl">
          <Text color="red">{error}</Text>
        </Center>
      ) : (
        <Stack gap="md">
          {/* よく使うテンプレート */}
          {popularTemplates.length > 0 && (
            <>
              <Group gap="xs">
                <IconTrendingUp size={20} />
                <Text size="sm" fw={500}>よく使うテンプレート</Text>
              </Group>
              <Stack gap="xs">
                {popularTemplates.map((template) => (
                  <Card
                    key={template.id}
                    padding="md"
                    radius="md"
                    withBorder
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <Group justify="space-between" align="flex-start">
                      <Stack gap="xs" style={{ flex: 1 }}>
                        <Group gap="sm">
                          <Text fw={500}>{template.name}</Text>
                          <Badge 
                            color={getTypeColor(template.type)} 
                            variant="light" 
                            size="sm"
                          >
                            {template.type === 'income' ? '収入' : '支出'}
                          </Badge>
                        </Group>
                        <Group gap="sm">
                          <Text size="sm" c="dimmed">
                            {template.category}
                            {template.subcategory && ` > ${template.subcategory}`}
                          </Text>
                          {template.paymentMethod && (
                            <Group gap="xs">
                              {getPaymentIcon(template.paymentMethod)}
                              <Text size="sm" c="dimmed">
                                {template.paymentMethod}
                              </Text>
                            </Group>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed">
                          {template.usageCount}回使用 • {formatLastUsed(template.lastUsed)}
                        </Text>
                      </Stack>
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTemplateDelete(template.id, template.name);
                          }}
                          loading={deletingId === template.id}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
              <Divider />
            </>
          )}

          {/* 最近使用したテンプレート */}
          {recentTemplates.length > 0 && (
            <>
              <Group gap="xs">
                <IconClock size={20} />
                <Text size="sm" fw={500}>最近使用したテンプレート</Text>
              </Group>
              <Stack gap="xs">
                {recentTemplates.map((template) => (
                  <Card
                    key={template.id}
                    padding="md"
                    radius="md"
                    withBorder
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <Group justify="space-between" align="flex-start">
                      <Stack gap="xs" style={{ flex: 1 }}>
                        <Group gap="sm">
                          <Text fw={500}>{template.name}</Text>
                          <Badge 
                            color={getTypeColor(template.type)} 
                            variant="light" 
                            size="sm"
                          >
                            {template.type === 'income' ? '収入' : '支出'}
                          </Badge>
                        </Group>
                        <Group gap="sm">
                          <Text size="sm" c="dimmed">
                            {template.category}
                            {template.subcategory && ` > ${template.subcategory}`}
                          </Text>
                          {template.paymentMethod && (
                            <Group gap="xs">
                              {getPaymentIcon(template.paymentMethod)}
                              <Text size="sm" c="dimmed">
                                {template.paymentMethod}
                              </Text>
                            </Group>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed">
                          {formatLastUsed(template.lastUsed)}
                        </Text>
                      </Stack>
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTemplateDelete(template.id, template.name);
                          }}
                          loading={deletingId === template.id}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
              <Divider />
            </>
          )}

          {/* 全テンプレート */}
          {templates.length > 0 ? (
            <>
              <Group gap="xs">
                <IconTemplate size={20} />
                <Text size="sm" fw={500}>すべてのテンプレート</Text>
              </Group>
              <Stack gap="xs">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    padding="md"
                    radius="md"
                    withBorder
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <Group justify="space-between" align="flex-start">
                      <Stack gap="xs" style={{ flex: 1 }}>
                        <Group gap="sm">
                          <Text fw={500}>{template.name}</Text>
                          <Badge 
                            color={getTypeColor(template.type)} 
                            variant="light" 
                            size="sm"
                          >
                            {template.type === 'income' ? '収入' : '支出'}
                          </Badge>
                        </Group>
                        <Group gap="sm">
                          <Text size="sm" c="dimmed">
                            {template.category}
                            {template.subcategory && ` > ${template.subcategory}`}
                          </Text>
                          {template.paymentMethod && (
                            <Group gap="xs">
                              {getPaymentIcon(template.paymentMethod)}
                              <Text size="sm" c="dimmed">
                                {template.paymentMethod}
                              </Text>
                            </Group>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed">
                          {template.usageCount}回使用 • {formatLastUsed(template.lastUsed)}
                        </Text>
                      </Stack>
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTemplateDelete(template.id, template.name);
                          }}
                          loading={deletingId === template.id}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </>
          ) : (
            <Center py="xl">
              <Stack align="center" gap="md">
                <IconTemplate size={48} color="gray" />
                <Text c="dimmed" ta="center">
                  まだテンプレートがありません
                  <br />
                  よく使う取引をテンプレートとして登録しましょう
                </Text>
              </Stack>
            </Center>
          )}

          {/* 新規テンプレート作成ボタン */}
          <Card padding="md" radius="md" withBorder>
            <Button
              fullWidth
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                onCreateTemplate();
                onClose();
              }}
            >
              新規テンプレート作成
            </Button>
          </Card>
        </Stack>
      )}
    </Modal>
  );
};