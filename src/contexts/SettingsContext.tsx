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
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  onSnapshot,
  doc,
  runTransaction,
  setDoc,
  Timestamp,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  UserSettings,
  CategorySetting,
  SubcategorySetting,
  PaymentMethodSetting,
  CategoryColor,
} from '@/types';
import {
  buildGenericDefaultSettings,
  buildLegacySettings,
} from '@/config/defaultSettings';
import { NEUTRAL_COLOR } from '@/config/colorPalette';
import { createTransactionRules, TransactionRules } from '@/utils/transactionRules';

const settingsDocRef = (uid: string) => doc(db, 'users', uid, 'settings', 'app');

// ============================================================
// Firestore シリアライズ / デシリアライズ
// ============================================================

/** undefined フィールドを除去しつつ Firestore 保存用に変換する */
const serializeSettings = (settings: UserSettings): DocumentData => ({
  schemaVersion: settings.schemaVersion,
  monthlyBudget: settings.monthlyBudget,
  categories: settings.categories.map((category) => ({
    id: category.id,
    name: category.name,
    type: category.type,
    roles: category.roles,
    color: category.color,
    subcategories: category.subcategories.map((sub) => ({
      id: sub.id,
      name: sub.name,
      roles: sub.roles,
      ...(sub.color ? { color: sub.color } : {}),
    })),
  })),
  paymentMethods: settings.paymentMethods.map((method) => ({
    id: method.id,
    name: method.name,
    isCash: method.isCash,
    rewardRate: method.rewardRate,
    color: method.color,
  })),
  createdAt: Timestamp.fromDate(settings.createdAt),
  updatedAt: Timestamp.fromDate(settings.updatedAt),
});

const deserializeSettings = (data: DocumentData): UserSettings => ({
  schemaVersion: 1,
  monthlyBudget: Number(data.monthlyBudget) || 0,
  categories: Array.isArray(data.categories)
    ? data.categories.map(
        (category: DocumentData): CategorySetting => ({
          id: category.id,
          name: category.name,
          type: category.type === 'income' ? 'income' : 'expense',
          roles: Array.isArray(category.roles) ? category.roles : [],
          color: category.color ?? NEUTRAL_COLOR,
          subcategories: Array.isArray(category.subcategories)
            ? category.subcategories.map(
                (sub: DocumentData): SubcategorySetting => ({
                  id: sub.id,
                  name: sub.name,
                  roles: Array.isArray(sub.roles) ? sub.roles : [],
                  ...(sub.color ? { color: sub.color } : {}),
                })
              )
            : [],
        })
      )
    : [],
  paymentMethods: Array.isArray(data.paymentMethods)
    ? data.paymentMethods.map(
        (method: DocumentData): PaymentMethodSetting => ({
          id: method.id,
          name: method.name,
          isCash: Boolean(method.isCash),
          rewardRate: Number(method.rewardRate) || 0,
          color: method.color ?? '#8b919e',
        })
      )
    : [],
  createdAt: data.createdAt?.toDate() ?? new Date(),
  updatedAt: data.updatedAt?.toDate() ?? new Date(),
});

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
  updateSettings: (patch: Partial<Omit<UserSettings, 'createdAt' | 'updatedAt'>>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

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

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = settingsDocRef(user.uid);

    const unsubscribe = onSnapshot(
      ref,
      async (snapshot) => {
        if (snapshot.exists()) {
          setSettings(deserializeSettings(snapshot.data()));
          setLoading(false);
          return;
        }

        // 設定doc未作成 → 自動シード(docが作成されると onSnapshot が再発火する)
        if (seedingRef.current) return;
        seedingRef.current = true;
        try {
          const txSnapshot = await getDocs(
            query(
              collection(db, 'transactions'),
              where('userId', '==', user.uid),
              limit(1)
            )
          );
          const seed = txSnapshot.empty
            ? buildGenericDefaultSettings()
            : buildLegacySettings();

          // 多タブ同時オープンによる二重シードを防ぐ(未存在時のみ作成)
          await runTransaction(db, async (tx) => {
            const current = await tx.get(ref);
            if (!current.exists()) {
              tx.set(ref, serializeSettings(seed));
            }
          });
        } catch (error) {
          console.error('Error seeding user settings:', error);
          setLoading(false);
        } finally {
          seedingRef.current = false;
        }
      },
      (error) => {
        console.error('Error listening to user settings:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const updateSettings = useCallback(
    async (patch: Partial<Omit<UserSettings, 'createdAt' | 'updatedAt'>>) => {
      if (!user || !settings) return;

      // 現在値にパッチを重ねて全体をシリアライズ(単一docの部分配列更新は不可のため)
      const next: UserSettings = {
        ...settings,
        ...patch,
        updatedAt: new Date(),
      };

      try {
        await setDoc(settingsDocRef(user.uid), serializeSettings(next), { merge: true });
      } catch (error) {
        console.error('Error updating user settings:', error);
        throw error;
      }
    },
    [user, settings]
  );

  const rules = useMemo(
    () => createTransactionRules(settings ?? EMPTY_SETTINGS),
    [settings]
  );

  // カテゴリ/サブカテゴリ名 → 色のマップ(サブカテゴリ優先で解決)
  const colorMap = useMemo(() => {
    const map = new Map<string, CategoryColor>();
    for (const category of (settings ?? EMPTY_SETTINGS).categories) {
      // サブカテゴリで上書きされないよう、カテゴリ名は未登録時のみ設定
      if (!map.has(category.name)) map.set(category.name, category.color);
      for (const sub of category.subcategories) {
        if (!map.has(sub.name)) map.set(sub.name, sub.color ?? category.color);
      }
    }
    return map;
  }, [settings]);

  const getColor = useCallback(
    (name: string, isDark: boolean): string => {
      const entry = colorMap.get(name) ?? NEUTRAL_COLOR;
      return isDark ? entry.dark : entry.light;
    },
    [colorMap]
  );

  const expenseCategories = useMemo(
    () => (settings?.categories ?? []).filter((c) => c.type === 'expense'),
    [settings]
  );
  const incomeCategories = useMemo(
    () => (settings?.categories ?? []).filter((c) => c.type === 'income'),
    [settings]
  );
  const paymentMethods = useMemo(() => settings?.paymentMethods ?? [], [settings]);

  const value = useMemo(
    () => ({
      settings,
      loading,
      rules,
      getColor,
      expenseCategories,
      incomeCategories,
      paymentMethods,
      updateSettings,
    }),
    [settings, loading, rules, getColor, expenseCategories, incomeCategories, paymentMethods, updateSettings]
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
