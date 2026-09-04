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
  /** 表示中の月(?month=)を持つタブか。この印が付いたタブ同士では月を引き継ぐ */
  carriesMonth: boolean;
}

export const TABS: TabDefinition[] = [
  { href: '/', label: 'ホーム', icon: IconHome, showAddButton: true, carriesMonth: true },
  { href: '/history', label: '履歴', icon: IconListDetails, showAddButton: true, carriesMonth: true },
  { href: '/review', label: '振り返り', icon: IconChartHistogram, showAddButton: false, carriesMonth: false },
  { href: '/settings', label: '設定', icon: IconSettings, showAddButton: false, carriesMonth: false },
];

/**
 * タブの遷移先を返す。ホームと履歴のあいだでは見ている月を引き継ぐ
 * （8月のホームから履歴を開いたら8月の履歴になる）。
 *
 * month が null のとき（＝URL に ?month= が無い＝アプリを開いた直後）は
 * 何も付けないので、これまでどおり当月が表示される。
 */
export const tabHref = (tab: TabDefinition, month: string | null): string =>
  tab.carriesMonth && month ? `${tab.href}?month=${month}` : tab.href;

/**
 * 現在のパスに対応するタブを返す。
 * ルートは完全一致、それ以外は前方一致（将来サブルートを足しても親タブが選択されたままになる）。
 */
export const findActiveTab = (pathname: string): TabDefinition | undefined =>
  TABS.find((tab) => (tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)));
