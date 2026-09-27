/**
 * div などを「押せる要素」にするための属性（#111）
 *
 * 中に段落やバッジを含む行・タイル・カレンダーのマスは、<button> にすると
 * 中身のマークアップが不正になる（button の中に置けるのは文中の要素だけ）。
 * そこで role="button" を付け、Tab で選べて Enter / Space で押せるようにし、
 * 読み上げ用の名前を付ける。見た目のフォーカス枠は globals.css の
 * [role='button']:focus-visible が付ける。
 *
 * 行の中に別のボタン（削除など）を置くときは、この要素の中に入れ子にせず兄弟にすること。
 */
import type { KeyboardEvent } from 'react';

export const pressable = (onPress: () => void, label: string, pressed?: boolean) => ({
  role: 'button' as const,
  tabIndex: 0,
  'aria-label': label,
  ...(pressed !== undefined ? { 'aria-pressed': pressed } : {}),
  onClick: onPress,
  onKeyDown: (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPress();
    }
  },
});
