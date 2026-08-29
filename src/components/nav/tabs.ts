/**
 * タブの定義
 *
 * ここが唯一の情報源。タブを増やすときはこの配列に足すだけでよい。
 * 順序がそのまま表示順（モバイルの下部バー / デスクトップの上部タブ）になる。
 */
import {
  IconChartHistogram,
  IconHome,
  IconListDetails,
  IconSettings,
  type Icon,
} from '@tabler/icons-react';

export interface TabDefinition {
  href: string;
  label: string;
  icon: Icon;
  /** 取引を追加する FAB を出すタブか（振り返り・設定では文脈に合わない） */
  showAddButton: boolean;
}

export const TABS: TabDefinition[] = [
  { href: '/', label: 'ホーム', icon: IconHome, showAddButton: true },
  { href: '/history', label: '履歴', icon: IconListDetails, showAddButton: true },
  { href: '/review', label: '振り返り', icon: IconChartHistogram, showAddButton: false },
  { href: '/settings', label: '設定', icon: IconSettings, showAddButton: false },
];

/**
 * 現在のパスに対応するタブを返す。
 * ルートは完全一致、それ以外は前方一致（将来サブルートを足しても親タブが選択されたままになる）。
 */
export const findActiveTab = (pathname: string): TabDefinition | undefined =>
  TABS.find((tab) => (tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)));
