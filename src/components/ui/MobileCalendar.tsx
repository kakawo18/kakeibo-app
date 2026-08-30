'use client';

/**
 * カレンダーのフルスクリーンモーダル
 *
 * 中身は CalendarView。取引フォームの日付選択（isSelector）から使う。
 * 履歴タブでは CalendarView を直接ページに埋め込んでいる。
 */
import { Modal } from '@mantine/core';
import { CalendarView } from '@/components/ui/CalendarView';
import { Transaction } from '@/types';

interface MobileCalendarProps {
  opened: boolean;
  onClose: () => void;
  value: Date;
  onChange: (date: Date) => void;
  transactions?: Transaction[];
  isSelector?: boolean;
}

export const MobileCalendar: React.FC<MobileCalendarProps> = ({
  opened,
  onClose,
  value,
  onChange,
  transactions = [],
  isSelector = false,
}) => (
  <Modal
    opened={opened}
    onClose={onClose}
    withCloseButton={false}
    fullScreen
    padding={0}
    transitionProps={{ duration: 200, transition: 'fade' }}
  >
    <CalendarView
      value={value}
      onChange={onChange}
      transactions={transactions}
      isSelector={isSelector}
      onClose={onClose}
      fillHeight
    />
  </Modal>
);
