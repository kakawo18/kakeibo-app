'use client';

/**
 * カテゴリ管理セクション
 *
 * 支出/収入のカテゴリ一覧を表示し、追加・編集・削除・並べ替えを行う。
 * 変更は即座に Firestore(users/{uid}/settings/app)へ保存される。
 */
import { useState } from 'react';
import {
  Paper,
  Text,
  Group,
  Stack,
  SegmentedControl,
  ActionIcon,
  Badge,
  Button,
  ColorSwatch,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconChevronUp,
  IconChevronDown,
  IconPencil,
  IconTrash,
  IconPlus,
} from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useSettings } from '@/contexts/SettingsContext';
import { useTransactions } from '@/contexts/TransactionsContext';
import { CategorySetting, CATEGORY_ROLE_LABELS } from '@/types';
import { CategoryEditModal } from './CategoryEditModal';

export const CategorySection = () => {
  const { updateSettings, expenseCategories, incomeCategories } = useSettings();
  const { transactions } = useTransactions();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [editorOpened, setEditorOpened] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategorySetting | null>(null);

  const list = type === 'expense' ? expenseCategories : incomeCategories;

  const saveList = async (newList: CategorySetting[]) => {
    // categories は支出/収入が混在した1つの配列なので、
    // 編集していない側と結合して全体を差し替える
    const other = type === 'expense' ? incomeCategories : expenseCategories;
    const categories =
      type === 'expense' ? [...newList, ...other] : [...other, ...newList];
    try {
      await updateSettings({ categories });
    } catch {
      notifications.show({
        title: 'エラー',
        message: '設定の保存に失敗しました。もう一度お試しください。',
        color: 'red',
      });
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const newList = [...list];
    [newList[index], newList[target]] = [newList[target], newList[index]];
    void saveList(newList);
  };

  const countUsage = (categoryName: string) =>
    transactions.filter((t) => t.category === categoryName).length;

  const handleAdd = () => {
    setEditingCategory(null);
    setEditorOpened(true);
  };

  const handleEdit = (category: CategorySetting) => {
    setEditingCategory(category);
    setEditorOpened(true);
  };

  const handleDelete = (category: CategorySetting) => {
    const count = countUsage(category.name);
    modals.openConfirmModal({
      title: 'カテゴリを削除',
      children: (
        <Text size="sm">
          「{category.name}」を削除しますか？
          {count > 0 &&
            ` このカテゴリを使う取引が${count}件あります。取引は削除されず、カテゴリ名のまま残ります（色はニュートラル表示になります）。`}
        </Text>
      ),
      labels: { confirm: '削除', cancel: 'キャンセル' },
      confirmProps: { color: 'red' },
      onConfirm: () => void saveList(list.filter((c) => c.id !== category.id)),
    });
  };

  const handleSave = (category: CategorySetting) => {
    const previous = list.find((c) => c.id === category.id);
    const newList = previous
      ? list.map((c) => (c.id === category.id ? category : c))
      : [...list, category];

    // リネーム時: 既存取引は旧名の文字列を保持し続けることを知らせる
    if (previous && previous.name !== category.name) {
      const count = countUsage(previous.name);
      if (count > 0) {
        notifications.show({
          title: 'カテゴリ名を変更しました',
          message: `${count}件の既存取引は旧カテゴリ名「${previous.name}」のままです`,
          color: 'yellow',
        });
      }
    }
    void saveList(newList);
  };

  return (
    <Paper className="ledger-card" p="lg">
      <Group justify="space-between" mb="md">
        <Text className="section-title">カテゴリ</Text>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={handleAdd}
        >
          追加
        </Button>
      </Group>

      <SegmentedControl
        data={[
          { label: '支出', value: 'expense' },
          { label: '収入', value: 'income' },
        ]}
        value={type}
        onChange={(value) => setType(value as 'expense' | 'income')}
        fullWidth
        mb="md"
        radius={10}
      />

      <Stack gap={0}>
        {list.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="md">
            カテゴリがありません
          </Text>
        )}
        {list.map((category, index) => (
          <Group
            key={category.id}
            justify="space-between"
            wrap="nowrap"
            py={10}
            px={4}
            style={{ borderBottom: '1px solid var(--hairline)' }}
          >
            <Group gap={10} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
              <ColorSwatch
                color={isDark ? category.color.dark : category.color.light}
                size={14}
                style={{ flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <Text size="sm" fw={600} truncate>
                  {category.name}
                </Text>
                {category.subcategories.length > 0 && (
                  <Text size="xs" c="dimmed" truncate>
                    {category.subcategories.map((sub) => sub.name).join('・')}
                  </Text>
                )}
                {(() => {
                  const roles = [
                    ...category.roles,
                    ...category.subcategories.flatMap((sub) => sub.roles),
                  ].filter((role, i, arr) => arr.indexOf(role) === i);
                  return roles.length > 0 ? (
                    <Group gap={4} mt={2}>
                      {roles.map((role) => (
                        <Badge key={role} size="xs" variant="light" color="indigo">
                          {CATEGORY_ROLE_LABELS[role]}
                        </Badge>
                      ))}
                    </Group>
                  ) : null;
                })()}
              </div>
            </Group>

            <Group gap={2} wrap="nowrap">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label="上へ移動"
              >
                <IconChevronUp size={15} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                disabled={index === list.length - 1}
                onClick={() => move(index, 1)}
                aria-label="下へ移動"
              >
                <IconChevronDown size={15} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                onClick={() => handleEdit(category)}
                aria-label="編集"
              >
                <IconPencil size={15} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="red"
                size="md"
                onClick={() => handleDelete(category)}
                aria-label="削除"
              >
                <IconTrash size={15} />
              </ActionIcon>
            </Group>
          </Group>
        ))}
      </Stack>

      <CategoryEditModal
        opened={editorOpened}
        onClose={() => setEditorOpened(false)}
        type={type}
        category={editingCategory}
        existingNames={list
          .filter((c) => c.id !== editingCategory?.id)
          .map((c) => c.name)}
        usedColors={[...expenseCategories, ...incomeCategories].map((c) => c.color)}
        onSave={handleSave}
      />
    </Paper>
  );
};
