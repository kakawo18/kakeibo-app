'use client';

/**
 * カテゴリ管理セクション
 *
 * 支出/収入のカテゴリ一覧を表示し、追加・編集・削除・並べ替えを行う。
 * 変更は即座に Firestore(users/{uid}/settings/app)へ保存される。
 *
 * 改名は旧名を「以前の名前」として残し、使用中のカテゴリの削除はアーカイブにする。
 * 過去の取引の集計（役割）が変わらないようにするため（#97。utils/categorySettings.ts）
 */
import { useMemo, useState } from 'react';
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
  useComputedColorScheme,
} from '@mantine/core';
import {
  IconChevronUp,
  IconChevronDown,
  IconPencil,
  IconTrash,
  IconPlus,
  IconArrowBackUp,
} from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useSettings } from '@/contexts/SettingsContext';
import { useTransactions } from '@/contexts/TransactionsContext';
import { CategorySetting, CATEGORY_ROLE_LABELS } from '@/types';
import { CategoryEditModal } from './CategoryEditModal';
import {
  UsageCheck,
  applyCategoryEdit,
  editableCategory,
  namesOf,
  removeCategory,
  restoreCategory,
} from '@/utils/categorySettings';

export const CategorySection = () => {
  const { updateSettings, expenseCategories, incomeCategories } = useSettings();
  const { transactions } = useTransactions();
  // 'auto' を実際の light/dark に解決する。useMantineColorScheme().colorScheme は
  // ユーザーが明示的に選ぶまで 'auto' のままなので、そのまま比較すると
  // OS がダークでも isDark が false になる
  const isDark = useComputedColorScheme('light', { getInitialValueInEffect: true }) === 'dark';

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [editorOpened, setEditorOpened] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategorySetting | null>(null);

  const list = type === 'expense' ? expenseCategories : incomeCategories;
  const activeList = list.filter((c) => !c.archived);
  const archivedList = list.filter((c) => c.archived);

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

  // 並べ替えは表示中（アーカイブ以外）のカテゴリの中で行う
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= activeList.length) return;
    const newList = [...activeList];
    [newList[index], newList[target]] = [newList[target], newList[index]];
    void saveList([...newList, ...archivedList]);
  };

  /** 取引で使われているか（今の名前・以前の名前のどちらで記録されていても数える） */
  const isUsed: UsageCheck = (categoryNames, subcategoryNames) =>
    transactions.some(
      (t) =>
        categoryNames.includes(t.category) &&
        (!subcategoryNames ||
          (t.subcategory !== undefined && subcategoryNames.includes(t.subcategory)))
    );

  const countUsage = (category: CategorySetting) => {
    const names = namesOf(category);
    return transactions.filter((t) => names.includes(t.category)).length;
  };

  // 同じ名前を二重に使わないよう、他のカテゴリの以前の名前・アーカイブも含めて重複を調べる
  const existingNames = useMemo(
    () =>
      list
        .filter((c) => c.id !== editingCategory?.id)
        .flatMap((c) => namesOf(c)),
    [list, editingCategory]
  );

  const handleAdd = () => {
    setEditingCategory(null);
    setEditorOpened(true);
  };

  const handleEdit = (category: CategorySetting) => {
    setEditingCategory(category);
    setEditorOpened(true);
  };

  const handleDelete = (category: CategorySetting) => {
    const count = countUsage(category);
    // 使われているカテゴリは消さずにアーカイブする。消すと過去の取引の役割（投資・給与など）が
    // 外れ、過去の収支や投資額が変わってしまうため（#97）
    modals.openConfirmModal({
      title: count > 0 ? 'カテゴリをアーカイブ' : 'カテゴリを削除',
      children: (
        <Text size="sm">
          {count > 0
            ? `「${category.name}」を使う取引が${count}件あるため、削除ではなくアーカイブします。入力の選択肢からは消えますが、過去の取引の集計・役割・色はそのまま残り、あとで戻せます。`
            : `「${category.name}」を削除しますか？`}
        </Text>
      ),
      labels: { confirm: count > 0 ? 'アーカイブ' : '削除', cancel: 'キャンセル' },
      confirmProps: { color: 'red' },
      onConfirm: () => void saveList(removeCategory(list, category, isUsed)),
    });
  };

  const handleRestore = (category: CategorySetting) => {
    void saveList(restoreCategory(list, category.id));
  };

  const handleSave = (edited: CategorySetting) => {
    const previous = list.find((c) => c.id === edited.id);
    const category = applyCategoryEdit(previous, edited, isUsed);
    const newList = previous
      ? list.map((c) => (c.id === category.id ? category : c))
      : [...list, category];

    // 改名しても過去の取引は同じカテゴリとして集計されることを知らせる
    if (previous && previous.name !== category.name) {
      const count = countUsage(previous);
      if (count > 0) {
        notifications.show({
          title: 'カテゴリ名を変更しました',
          message: `「${previous.name}」で記録した${count}件の取引も「${category.name}」として集計します`,
          color: 'blue',
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
        {activeList.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="md">
            カテゴリがありません
          </Text>
        )}
        {activeList.map((category, index) => (
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
                {category.subcategories.some((sub) => !sub.archived) && (
                  <Text size="xs" c="dimmed" truncate>
                    {category.subcategories
                      .filter((sub) => !sub.archived)
                      .map((sub) => sub.name)
                      .join('・')}
                  </Text>
                )}
                {category.aliases && category.aliases.length > 0 && (
                  <Text size="xs" c="dimmed" truncate>
                    以前の名前: {category.aliases.join('・')}
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
                size={40}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label="上へ移動"
              >
                <IconChevronUp size={15} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="gray"
                size={40}
                disabled={index === activeList.length - 1}
                onClick={() => move(index, 1)}
                aria-label="下へ移動"
              >
                <IconChevronDown size={15} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="gray"
                size={40}
                onClick={() => handleEdit(category)}
                aria-label="編集"
              >
                <IconPencil size={15} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="red"
                size={40}
                onClick={() => handleDelete(category)}
                aria-label="削除"
              >
                <IconTrash size={15} />
              </ActionIcon>
            </Group>
          </Group>
        ))}
      </Stack>

      {archivedList.length > 0 && (
        <Stack gap={0} mt="md">
          <Text size="xs" c="dimmed" fw={600} mb={4}>
            アーカイブ（入力の選択肢に出ません。過去の取引の集計には使います）
          </Text>
          {archivedList.map((category) => (
            <Group
              key={category.id}
              justify="space-between"
              wrap="nowrap"
              py={6}
              px={4}
              style={{ borderBottom: '1px solid var(--hairline)' }}
            >
              <Group gap={10} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                <ColorSwatch
                  color={isDark ? category.color.dark : category.color.light}
                  size={14}
                  style={{ flexShrink: 0 }}
                />
                <Text size="sm" c="dimmed" truncate>
                  {category.name}
                </Text>
              </Group>
              <Button
                variant="subtle"
                size="xs"
                h={40}
                color="gray"
                leftSection={<IconArrowBackUp size={14} />}
                onClick={() => handleRestore(category)}
                aria-label={`${category.name}を戻す`}
              >
                戻す
              </Button>
            </Group>
          ))}
        </Stack>
      )}

      <CategoryEditModal
        opened={editorOpened}
        onClose={() => setEditorOpened(false)}
        type={type}
        category={editingCategory ? editableCategory(editingCategory) : null}
        existingNames={existingNames}
        usedColors={[...expenseCategories, ...incomeCategories].map((c) => c.color)}
        onSave={handleSave}
      />
    </Paper>
  );
};
