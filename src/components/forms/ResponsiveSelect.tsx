'use client';

import { Select, NativeSelect } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { getInputStyles } from './formStyles';

interface SelectOption {
  value: string;
  label: string;
}

interface ResponsiveSelectProps {
  label: string;
  /** デスクトップのプレースホルダー兼、モバイルの先頭（未選択）オプションのラベル */
  placeholder: string;
  data: SelectOption[];
  required?: boolean;
  value?: string;
  defaultValue?: string;
  error?: React.ReactNode;
  onChange?: (value: string) => void;
}

/**
 * デバイスに応じて実装を切り替えるセレクト
 *
 * - モバイル: OSネイティブのピッカーが開く NativeSelect（PWAでの操作性重視）
 * - デスクトップ: 検索可能な Mantine Select
 *
 * Mantine Form の getInputProps をそのままスプレッドして使える。
 */
export const ResponsiveSelect: React.FC<ResponsiveSelectProps> = ({
  label,
  placeholder,
  data,
  required,
  value,
  defaultValue,
  error,
  onChange,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    return (
      <NativeSelect
        label={label}
        required={required}
        value={value}
        defaultValue={defaultValue}
        error={error}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        // 必須項目では未選択オプションを選び直せないようにする
        data={[{ value: '', label: placeholder, disabled: required }, ...data]}
        styles={getInputStyles(true)}
      />
    );
  }

  return (
    <Select
      label={label}
      placeholder={placeholder}
      data={data}
      required={required}
      value={value}
      defaultValue={defaultValue}
      error={error}
      onChange={(newValue) => onChange?.(newValue ?? '')}
      searchable
    />
  );
};
