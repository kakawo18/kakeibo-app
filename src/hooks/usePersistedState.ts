'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * localStorage に永続化する state（チャートの表示条件など端末ごとの UI 状態向け）。
 *
 * useSyncExternalStore で localStorage を購読するため、
 * - SSR / ハイドレーション時は「未保存(null)」、その直後にクライアントの保存値へ切り替わる
 * - 同一タブ・他タブどちらの更新も同じキーを使う全コンポーネントへ反映される
 * localStorage が使えない環境（プライベートモード等）ではメモリ上の値で代替する。
 */

/** localStorage が使えない場合のフォールバック（セッション内のみ保持） */
const memoryStore = new Map<string, string>();

/** 同一タブ内の書き込み通知用（storage イベントは書き込んだタブには飛ばないため） */
const listeners = new Map<string, Set<() => void>>();

const readRaw = (key: string): string | null => {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) return stored;
  } catch {
    // アクセス不可 → メモリ上の値にフォールバック
  }
  return memoryStore.get(key) ?? null;
};

const writeRaw = (key: string, raw: string): void => {
  memoryStore.set(key, raw);
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // 保存できなくてもセッション内は memoryStore で維持する
  }
  listeners.get(key)?.forEach((listener) => listener());
};

/**
 * @param key    localStorage のキー
 * @param parse  保存値の検証。想定外の形式なら null を返すこと（古い形式の値を無視する）。
 *               依存配列に入るためモジュールスコープの関数を渡す。
 * @returns      [保存値（未保存なら null）, 保存する関数]
 */
export function usePersistedState<T>(
  key: string,
  parse: (raw: unknown) => T | null
): [T | null, (value: T) => void] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const keyListeners = listeners.get(key) ?? new Set<() => void>();
      keyListeners.add(onStoreChange);
      listeners.set(key, keyListeners);

      const handleStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === key) onStoreChange();
      };
      window.addEventListener('storage', handleStorage);

      return () => {
        keyListeners.delete(onStoreChange);
        if (keyListeners.size === 0) listeners.delete(key);
        window.removeEventListener('storage', handleStorage);
      };
    },
    [key]
  );

  // スナップショットは文字列のまま返す（毎レンダーで新しい参照を作らないため）
  const raw = useSyncExternalStore(
    subscribe,
    useCallback(() => readRaw(key), [key]),
    () => null
  );

  const value = useMemo(() => {
    if (raw === null) return null;
    try {
      return parse(JSON.parse(raw));
    } catch {
      return null; // 破損した値は未保存として扱う
    }
  }, [raw, parse]);

  const persist = useCallback((next: T) => writeRaw(key, JSON.stringify(next)), [key]);

  return [value, persist];
}
