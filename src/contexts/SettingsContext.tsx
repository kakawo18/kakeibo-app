'use client';

/**
 * ユーザー設定の共有コンテキスト
 *
 * Firestore の users/{uid}/settings/app を onSnapshot で購読し、
 * カテゴリ・支払方法・月間予算と、それらから導出される
 * 集計ルール(rules)・色リゾルバ(getColor)をアプリ全体に供給する。
 *
 * 設定ドキュメントが存在しない場合は初回ロード時に自動シードする:
 * - 取引データを持つ既存ユーザー → 旧ハードコード値(レガシー設定)
 * - 新規ユーザー → 汎用デフォルト設定
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { UserSettings, CategoryColor, CategorySetting, PaymentMethodSetting } from '@/types';
import { SettingsPatch } from '@/data/settingsSerializer';
import { patchSettings, seedSettingsIfMissing, subscribeSettings } from '@/data/settingsRepository';
import { NEUTRAL_COLOR } from '@/config/colorPalette';
import { createTransactionRules, TransactionRules } from '@/utils/transactionRules';
import { settle } from '@/contexts/writeResult';

// ============================================================
// Context
// ============================================================

interface SettingsContextType {
  /** ロード完了(loading=false)後は non-null */
  settings: UserSettings | null;
  loading: boolean;
  /** 役割ベースの集計ルール(設定から導出) */
  rules: TransactionRules;
  /** カテゴリ/サブカテゴリ名 → テーマ対応色。未知の名前はニュートラル */
  getColor: (name: string, isDark: boolean) => string;
  expenseCategories: CategorySetting[];
  incomeCategories: CategorySetting[];
  paymentMethods: PaymentMethodSetting[];
  /** 取得・初期設定の作成に失敗したときのエラー（#105） */
  error: Error | null;
  /** 取得をやり直す */
  retry: () => void;
  /** 渡した項目だけを保存する（他の項目は書かない） */
  updateSettings: (patch: SettingsPatch) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

/**
 * 中身が同じなら前の参照を使い回す
 *
 * スナップショットのたびに配列を作り直すと、グラフの表示設定だけが変わっても
 * カテゴリ由来の rules・色・一覧が作り直され、全期間の集計がやり直しになる（#104）。
 */
const keepIfSame = <T,>(previous: T | undefined, next: T): T =>
  previous !== undefined && JSON.stringify(previous) === JSON.stringify(next) ? previous : next;

/** 設定ロード前でも安全に呼べるフォールバックルール(空設定由来) */
const EMPTY_SETTINGS: UserSettings = {
  schemaVersion: 1,
  monthlyBudget: 0,
  categories: [],
  paymentMethods: [],
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const seedingRef = useRef(false);
  // 取得・初期設定の作成に失敗したとき。どのユーザーの何回目の購読かと一緒に持つ（#105）
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<{ uid: string; attempt: number; error: Error } | null>(null);

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const uid = user.uid;

    // 購読・初期設定の作成・保存形式の変換は data/settingsRepository.ts（#122）
    const unsubscribe = subscribeSettings(db, uid, {
      onChange: async (next) => {
        if (next) {
          setSettings((previous) => ({
            ...next,
            categories: keepIfSame(previous?.categories, next.categories),
            paymentMethods: keepIfSame(previous?.paymentMethods, next.paymentMethods),
          }));
          setLoading(false);
          return;
        }

        // 設定doc未作成 → 自動シード(docが作成されると onSnapshot が再発火する)
        if (seedingRef.current) return;
        seedingRef.current = true;
        try {
          await seedSettingsIfMissing(db, uid);
        } catch (error) {
          console.error('Error seeding user settings:', error);
          // 空の設定のまま画面を出すと、役割が無いので集計が静かにずれる。失敗として扱う
          setFailure({ uid, attempt, error: error as Error });
          setLoading(false);
        } finally {
          seedingRef.current = false;
        }
      },
      onError: (error) => {
        console.error('Error listening to user settings:', error);
        setFailure({ uid, attempt, error });
        setLoading(false);
      },
    });

    return unsubscribe;
  }, [user, attempt]);

  const error =
    user && failure?.uid === user.uid && failure.attempt === attempt ? failure.error : null;

  /** 購読をやり直す（取得に失敗したときの再試行） */
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  // 設定ドキュメントができる前（シード前）は書かない
  const settingsReady = settings !== null;

  const updateSettings = useCallback(
    async (patch: SettingsPatch) => {
      if (!user || !settingsReady) return;

      // 渡された項目だけを書く。手元の設定全体を書き戻すと、まだ届いていない
      // 他端末の変更（カテゴリ・予算など）を古い値で上書きしてしまう（#104）
      try {
        // オフラインではサーバーの確定を待たずに返す（#126）
        await settle(patchSettings(db, user.uid, patch));
      } catch (error) {
        console.error('Error updating user settings:', error);
        throw error;
      }
    },
    [user, settingsReady]
  );

  const categories = settings?.categories;
  const paymentMethodList = settings?.paymentMethods;

  // 集計ルールはカテゴリと支払方法だけから作る。予算やグラフの表示設定が
  // 変わっても作り直さない（作り直すと全画面の集計がやり直しになる）
  const rules = useMemo(
    () =>
      createTransactionRules({
        ...EMPTY_SETTINGS,
        categories: categories ?? [],
        paymentMethods: paymentMethodList ?? [],
      }),
    [categories, paymentMethodList]
  );

  // カテゴリ/サブカテゴリ名 → 色のマップ(サブカテゴリ優先で解決)
  const colorMap = useMemo(() => {
    const map = new Map<string, CategoryColor>();
    for (const category of categories ?? []) {
      // サブカテゴリで上書きされないよう、カテゴリ名は未登録時のみ設定
      if (!map.has(category.name)) map.set(category.name, category.color);
      for (const sub of category.subcategories) {
        if (!map.has(sub.name)) map.set(sub.name, sub.color ?? category.color);
      }
    }
    // 改名前の名前（#97）。今の名前と重なるものは今の名前の色を優先する
    for (const category of categories ?? []) {
      for (const alias of category.aliases ?? []) {
        if (!map.has(alias)) map.set(alias, category.color);
      }
      for (const sub of category.subcategories) {
        for (const alias of sub.aliases ?? []) {
          if (!map.has(alias)) map.set(alias, sub.color ?? category.color);
        }
      }
    }
    return map;
  }, [categories]);

  const getColor = useCallback(
    (name: string, isDark: boolean): string => {
      const entry = colorMap.get(name) ?? NEUTRAL_COLOR;
      return isDark ? entry.dark : entry.light;
    },
    [colorMap]
  );

  const expenseCategories = useMemo(
    () => (categories ?? []).filter((c) => c.type === 'expense'),
    [categories]
  );
  const incomeCategories = useMemo(
    () => (categories ?? []).filter((c) => c.type === 'income'),
    [categories]
  );
  const paymentMethods = useMemo(() => paymentMethodList ?? [], [paymentMethodList]);

  const value = useMemo(
    () => ({
      settings,
      loading,
      error,
      retry,
      rules,
      getColor,
      expenseCategories,
      incomeCategories,
      paymentMethods,
      updateSettings,
    }),
    [settings, loading, error, retry, rules, getColor, expenseCategories, incomeCategories, paymentMethods, updateSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};
