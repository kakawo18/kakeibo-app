'use client';

/**
 * カテゴリ編集モーダル
 *
 * カテゴリの名前・色(スウォッチ選択)・役割・サブカテゴリを編集する。
 * 保存ボタンで onSave に完成した CategorySetting を渡す(Firestore への
 * 書き込みは呼び出し側 CategorySection が行う)。
 */
import { useState } from 'react';
import {
  Modal,
  Stack,
  Group,
  TextInput,
  Button,
  Text,
  Chip,
  ColorSwatch,
  CheckIcon,
  ActionIcon,
  MultiSelect,
  Divider,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import {
  CategorySetting,
  SubcategorySetting,
  CategoryRole,
  CategoryColor,
  CATEGORY_ROLE_LABELS,
} from '@/types';
import { SWATCH_COLORS, pickLeastUsedColor } from '@/config/colorPalette';

const ROLE_OPTIONS = (Object.entries(CATEGORY_ROLE_LABELS) as [CategoryRole, string][])
  .map(([value, label]) => ({ value, label }));

const newId = (): string => crypto.randomUUID();

interface CategoryEditModalProps {
  opened: boolean;
  onClose: () => void;
  type: 'expense' | 'income';
  /** null = 新規作成 */
  category: CategorySetting | null;
  /** 同一タイプ内の既存カテゴリ名(重複チェック用。編集中の自分自身は除外済みで渡す) */
  existingNames: string[];
  /** 使用中の色(新規作成時の自動割当に使用) */
  usedColors: CategoryColor[];
  onSave: (category: CategorySetting) => void;
}

export const CategoryEditModal: React.FC<CategoryEditModalProps> = ({
  opened,
  onClose,
  type,
  category,
  existingNames,
  usedColors,
  onSave,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={category ? 'カテゴリを編集' : '新しいカテゴリを追加'}
      size={isMobile ? 'full' : 'lg'}
      fullScreen={isMobile}
      radius={isMobile ? 0 : undefined}
    >
      {/* Modalは閉じると中身をアンマウントするため、開くたびに初期値から再マウントされる */}
      <CategoryEditor
        type={type}
        category={category}
        existingNames={existingNames}
        usedColors={usedColors}
        onSave={onSave}
        onClose={onClose}
        isMobile={isMobile ?? false}
      />
    </Modal>
  );
};

const CategoryEditor: React.FC<
  Omit<CategoryEditModalProps, 'opened'> & { isMobile: boolean }
> = ({ type, category, existingNames, usedColors, onSave, onClose, isMobile }) => {
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState<CategoryColor>(
    () => category?.color ?? pickLeastUsedColor(usedColors)
  );
  const [roles, setRoles] = useState<string[]>(category?.roles ?? []);
  const [subcategories, setSubcategories] = useState<SubcategorySetting[]>(
    () => category?.subcategories.map((sub) => ({ ...sub })) ?? []
  );
  const [error, setError] = useState<string | null>(null);

  const handleAddSubcategory = () => {
    setSubcategories((subs) => [...subs, { id: newId(), name: '', roles: [] }]);
  };

  const handleSubcategoryChange = (id: string, patch: Partial<SubcategorySetting>) => {
    setSubcategories((subs) => subs.map((sub) => (sub.id === id ? { ...sub, ...patch } : sub)));
  };

  const handleRemoveSubcategory = (id: string) => {
    setSubcategories((subs) => subs.filter((sub) => sub.id !== id));
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('カテゴリ名を入力してください');
      return;
    }
    if (existingNames.includes(trimmedName)) {
      setError('同じ名前のカテゴリが既にあります');
      return;
    }
    const subNames = subcategories.map((sub) => sub.name.trim());
    if (subNames.some((subName) => !subName)) {
      setError('名前が空のサブカテゴリがあります');
      return;
    }
    if (new Set(subNames).size !== subNames.length) {
      setError('サブカテゴリ名が重複しています');
      return;
    }

    onSave({
      id: category?.id ?? newId(),
      name: trimmedName,
      type,
      roles: roles as CategoryRole[],
      color,
      subcategories: subcategories.map((sub) => ({ ...sub, name: sub.name.trim() })),
    });
    onClose();
  };

  return (
      <Stack>
        <TextInput
          label="カテゴリ名"
          placeholder="例: 食費"
          required
          value={name}
          onChange={(e) => {
            setName(e.currentTarget.value);
            setError(null);
          }}
          error={error}
        />

        <div>
          <Text size="sm" fw={500} mb={6}>色</Text>
          <Group gap={8}>
            {SWATCH_COLORS.map((swatch) => (
              <ColorSwatch
                key={swatch.light}
                color={swatch.light}
                size={28}
                style={{ cursor: 'pointer' }}
                onClick={() => setColor(swatch)}
                component="button"
                type="button"
                aria-label={`色 ${swatch.light}`}
              >
                {color.light === swatch.light && <CheckIcon size={12} color="#fff" />}
              </ColorSwatch>
            ))}
          </Group>
        </div>

        <div>
          <Text size="sm" fw={500} mb={2}>役割</Text>
          <Text size="xs" c="dimmed" mb={8}>
            貯蓄率・投資額などの集計はカテゴリ名ではなく役割で判定されます
          </Text>
          <Chip.Group multiple value={roles} onChange={setRoles}>
            <Group gap={6}>
              {ROLE_OPTIONS.map((role) => (
                <Chip key={role.value} value={role.value} size="xs">
                  {role.label}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </div>

        <Divider />

        <div>
          <Group justify="space-between" mb={8}>
            <Text size="sm" fw={500}>サブカテゴリ</Text>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={handleAddSubcategory}
            >
              追加
            </Button>
          </Group>
          <Stack gap="xs">
            {subcategories.length === 0 && (
              <Text size="xs" c="dimmed">サブカテゴリはありません</Text>
            )}
            {subcategories.map((sub) => (
              <Group key={sub.id} gap="xs" align="flex-start" wrap="nowrap">
                <TextInput
                  placeholder="サブカテゴリ名"
                  value={sub.name}
                  onChange={(e) => handleSubcategoryChange(sub.id, { name: e.currentTarget.value })}
                  style={{ flex: 1, minWidth: 0 }}
                  size="sm"
                />
                <MultiSelect
                  placeholder={sub.roles.length === 0 ? '役割' : undefined}
                  data={ROLE_OPTIONS}
                  value={sub.roles}
                  onChange={(value) => handleSubcategoryChange(sub.id, { roles: value as CategoryRole[] })}
                  size="sm"
                  w={isMobile ? 132 : 200}
                  comboboxProps={{ withinPortal: true }}
                />
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="lg"
                  onClick={() => handleRemoveSubcategory(sub.id)}
                  aria-label="サブカテゴリを削除"
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        </div>

        <Group justify="flex-end" mt="sm">
          <Button variant="light" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSave} data-testid="category-save">
            {category ? '更新' : '追加'}
          </Button>
        </Group>
      </Stack>
  );
};
