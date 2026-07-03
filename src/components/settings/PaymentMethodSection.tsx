'use client';

/**
 * 支払い方法・カード管理セクション
 *
 * 支払方法(現金/クレジットカード)の追加・編集・削除と、
 * カードの還元率・表示色の設定を行う。
 */
import { useState } from 'react';
import {
  Paper,
  Text,
  Group,
  Stack,
  ActionIcon,
  Badge,
  Button,
  ColorSwatch,
  CheckIcon,
  Modal,
  TextInput,
  NumberInput,
  Switch,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconPencil, IconTrash, IconPlus } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useSettings } from '@/contexts/SettingsContext';
import { useTransactions } from '@/contexts/TransactionsContext';
import { PaymentMethodSetting } from '@/types';
import { PAYMENT_METHOD_SWATCHES } from '@/config/colorPalette';

const newId = (): string => crypto.randomUUID();

// ============================================================
// 編集モーダル
// ============================================================

interface PaymentMethodEditModalProps {
  opened: boolean;
  onClose: () => void;
  method: PaymentMethodSetting | null;
  existingNames: string[];
  onSave: (method: PaymentMethodSetting) => void;
}

const PaymentMethodEditModal: React.FC<PaymentMethodEditModalProps> = ({
  opened,
  onClose,
  method,
  existingNames,
  onSave,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={method ? '支払方法を編集' : '新しい支払方法を追加'}
      size={isMobile ? 'full' : 'md'}
      fullScreen={isMobile}
      radius={isMobile ? 0 : undefined}
    >
      {/* Modalは閉じると中身をアンマウントするため、開くたびに初期値から再マウントされる */}
      <PaymentMethodEditor
        method={method}
        existingNames={existingNames}
        onSave={onSave}
        onClose={onClose}
      />
    </Modal>
  );
};

const PaymentMethodEditor: React.FC<Omit<PaymentMethodEditModalProps, 'opened'>> = ({
  method,
  existingNames,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(method?.name ?? '');
  const [isCash, setIsCash] = useState(method?.isCash ?? false);
  const [rewardRatePercent, setRewardRatePercent] = useState<number | string>(
    method ? method.rewardRate * 100 : 0
  );
  const [color, setColor] = useState(method?.color ?? PAYMENT_METHOD_SWATCHES[0]);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('名前を入力してください');
      return;
    }
    if (existingNames.includes(trimmedName)) {
      setError('同じ名前の支払方法が既にあります');
      return;
    }

    onSave({
      id: method?.id ?? newId(),
      name: trimmedName,
      isCash,
      // 現金扱いは還元対象外
      rewardRate: isCash ? 0 : (Number(rewardRatePercent) || 0) / 100,
      color,
    });
    onClose();
  };

  return (
      <Stack>
        <TextInput
          label="名前"
          placeholder="例: 楽天カード"
          required
          value={name}
          onChange={(e) => {
            setName(e.currentTarget.value);
            setError(null);
          }}
          error={error}
        />

        <Switch
          label="現金扱い(カード支払いとして扱わない)"
          description="オンにすると支払い時に残高から即時引き落とされる扱いになります"
          checked={isCash}
          onChange={(e) => setIsCash(e.currentTarget.checked)}
        />

        {!isCash && (
          <NumberInput
            label="ポイント還元率(%)"
            placeholder="例: 1.0"
            min={0}
            max={100}
            step={0.05}
            decimalScale={2}
            value={rewardRatePercent}
            onChange={setRewardRatePercent}
          />
        )}

        <div>
          <Text size="sm" fw={500} mb={6}>表示色</Text>
          <Group gap={8}>
            {PAYMENT_METHOD_SWATCHES.map((swatch) => (
              <ColorSwatch
                key={swatch}
                color={swatch}
                size={28}
                style={{ cursor: 'pointer' }}
                onClick={() => setColor(swatch)}
                component="button"
                type="button"
                aria-label={`色 ${swatch}`}
              >
                {color === swatch && <CheckIcon size={12} color="#fff" />}
              </ColorSwatch>
            ))}
          </Group>
        </div>

        <Group justify="flex-end" mt="sm">
          <Button variant="light" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSave}>{method ? '更新' : '追加'}</Button>
        </Group>
      </Stack>
  );
};

// ============================================================
// セクション本体
// ============================================================

export const PaymentMethodSection = () => {
  const { paymentMethods, updateSettings } = useSettings();
  const { transactions } = useTransactions();

  const [editorOpened, setEditorOpened] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethodSetting | null>(null);

  const saveList = async (newList: PaymentMethodSetting[]) => {
    try {
      await updateSettings({ paymentMethods: newList });
    } catch {
      notifications.show({
        title: 'エラー',
        message: '設定の保存に失敗しました。もう一度お試しください。',
        color: 'red',
      });
    }
  };

  const countUsage = (methodName: string) =>
    transactions.filter((t) => t.paymentMethod === methodName).length;

  const handleAdd = () => {
    setEditingMethod(null);
    setEditorOpened(true);
  };

  const handleEdit = (method: PaymentMethodSetting) => {
    setEditingMethod(method);
    setEditorOpened(true);
  };

  const handleDelete = (method: PaymentMethodSetting) => {
    const count = countUsage(method.name);
    modals.openConfirmModal({
      title: '支払方法を削除',
      children: (
        <Text size="sm">
          「{method.name}」を削除しますか？
          {count > 0 &&
            ` この支払方法を使う取引が${count}件あります。取引は削除されず、支払方法名のまま残ります。`}
        </Text>
      ),
      labels: { confirm: '削除', cancel: 'キャンセル' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        void saveList(paymentMethods.filter((m) => m.id !== method.id)),
    });
  };

  const handleSave = (method: PaymentMethodSetting) => {
    const exists = paymentMethods.some((m) => m.id === method.id);
    const newList = exists
      ? paymentMethods.map((m) => (m.id === method.id ? method : m))
      : [...paymentMethods, method];
    void saveList(newList);
  };

  return (
    <Paper className="ledger-card" p="lg">
      <Group justify="space-between" mb="md">
        <Text className="section-title">支払い方法・カード</Text>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={handleAdd}
        >
          追加
        </Button>
      </Group>

      <Stack gap={0}>
        {paymentMethods.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="md">
            支払方法がありません
          </Text>
        )}
        {paymentMethods.map((method) => (
          <Group
            key={method.id}
            justify="space-between"
            wrap="nowrap"
            py={10}
            px={4}
            style={{ borderBottom: '1px solid var(--hairline)' }}
          >
            <Group gap={10} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
              <ColorSwatch color={method.color} size={14} />
              <Text size="sm" fw={600} truncate>
                {method.name}
              </Text>
              {method.isCash ? (
                <Badge size="xs" variant="light" color="gray">現金扱い</Badge>
              ) : (
                <Badge size="xs" variant="light" color="green">
                  還元率 {(method.rewardRate * 100).toFixed(2)}%
                </Badge>
              )}
            </Group>

            <Group gap={2} wrap="nowrap">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                onClick={() => handleEdit(method)}
                aria-label="編集"
              >
                <IconPencil size={15} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="red"
                size="md"
                onClick={() => handleDelete(method)}
                aria-label="削除"
              >
                <IconTrash size={15} />
              </ActionIcon>
            </Group>
          </Group>
        ))}
      </Stack>

      <PaymentMethodEditModal
        opened={editorOpened}
        onClose={() => setEditorOpened(false)}
        method={editingMethod}
        existingNames={paymentMethods
          .filter((m) => m.id !== editingMethod?.id)
          .map((m) => m.name)}
        onSave={handleSave}
      />
    </Paper>
  );
};
