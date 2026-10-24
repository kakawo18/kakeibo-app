/**
 * ユーザー設定（users/{uid}/settings/app）の Firestore 保存形式との変換
 *
 * 部分更新（toSettingsPatchData）は、渡されたフィールドだけを書く（#104）。
 * 以前は手元の設定全体を書き戻していたため、グラフの表示設定を保存しただけでも、
 * まだ届いていない他端末のカテゴリ・予算・カードの変更を古い値で上書きしていた。
 */
import { DocumentData, Timestamp } from 'firebase/firestore';
import {
  CategorySetting,
  PaymentMethodSetting,
  SubcategorySetting,
  UserSettings,
} from '@/types';
import { NEUTRAL_COLOR } from '@/config/colorPalette';

/** 更新できる設定項目（作成日時・更新日時はこちらで付ける） */
export type SettingsPatch = Partial<Omit<UserSettings, 'createdAt' | 'updatedAt'>>;

/** 以前の名前・アーカイブ（#97）。持っているときだけ書く */
const optionalMeta = (item: { aliases?: string[]; archived?: boolean }) => ({
  ...(item.aliases && item.aliases.length > 0 ? { aliases: item.aliases } : {}),
  ...(item.archived ? { archived: true } : {}),
});

const readMeta = (data: DocumentData): { aliases?: string[]; archived?: boolean } => {
  const aliases = Array.isArray(data.aliases)
    ? data.aliases.filter((name: unknown): name is string => typeof name === 'string')
    : [];
  return {
    ...(aliases.length > 0 ? { aliases } : {}),
    ...(data.archived === true ? { archived: true } : {}),
  };
};

const serializeCategories = (categories: CategorySetting[]) =>
  categories.map((category) => ({
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
      ...optionalMeta(sub),
    })),
    ...optionalMeta(category),
  }));

const serializePaymentMethods = (methods: PaymentMethodSetting[]) =>
  methods.map((method) => ({
    id: method.id,
    name: method.name,
    isCash: method.isCash,
    rewardRate: method.rewardRate,
    color: method.color,
  }));

/** 設定ドキュメントを丸ごと作るとき（初回のシード）用。undefined は書かない */
export const serializeSettings = (settings: UserSettings): DocumentData => ({
  schemaVersion: settings.schemaVersion,
  monthlyBudget: settings.monthlyBudget,
  categories: serializeCategories(settings.categories),
  paymentMethods: serializePaymentMethods(settings.paymentMethods),
  ...(settings.chartPreferences?.categoryTrendCategories
    ? {
        chartPreferences: {
          categoryTrendCategories: settings.chartPreferences.categoryTrendCategories,
        },
      }
    : {}),
  createdAt: Timestamp.fromDate(settings.createdAt),
  updatedAt: Timestamp.fromDate(settings.updatedAt),
});

/**
 * 部分更新の書き込みデータ（updateDoc 用）
 *
 * patch に入っているフィールドだけを書く。グラフの表示設定はドット区切りの
 * パスで書き、chartPreferences の他の項目を消さないようにする。
 */
export const toSettingsPatchData = (patch: SettingsPatch, updatedAt: Date): DocumentData => {
  const data: DocumentData = {};

  if (patch.schemaVersion !== undefined) data.schemaVersion = patch.schemaVersion;
  if (patch.monthlyBudget !== undefined) data.monthlyBudget = patch.monthlyBudget;
  if (patch.categories !== undefined) data.categories = serializeCategories(patch.categories);
  if (patch.paymentMethods !== undefined) {
    data.paymentMethods = serializePaymentMethods(patch.paymentMethods);
  }
  if (patch.chartPreferences?.categoryTrendCategories !== undefined) {
    data['chartPreferences.categoryTrendCategories'] =
      patch.chartPreferences.categoryTrendCategories;
  }

  data.updatedAt = Timestamp.fromDate(updatedAt);
  return data;
};

export const deserializeSettings = (data: DocumentData): UserSettings => ({
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
                  ...readMeta(sub),
                })
              )
            : [],
          ...readMeta(category),
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
          color: method.color ?? NEUTRAL_COLOR.light,
        })
      )
    : [],
  ...(Array.isArray(data.chartPreferences?.categoryTrendCategories)
    ? {
        chartPreferences: {
          categoryTrendCategories: data.chartPreferences.categoryTrendCategories.filter(
            (name: unknown): name is string => typeof name === 'string'
          ),
        },
      }
    : {}),
  createdAt: data.createdAt?.toDate() ?? new Date(),
  updatedAt: data.updatedAt?.toDate() ?? new Date(),
});
