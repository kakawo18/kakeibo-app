/**
 * カテゴリ設定の改名・削除（#97）
 *
 * 取引はカテゴリ名・サブカテゴリ名の文字列だけを持つ。設定側で名前を変えたり
 * 消したりすると、過去の取引が設定と結びつかなくなり、役割（投資・給与など）が
 * 外れて過去の収支・投資額が変わっていた。
 *
 * 取引のドキュメントは書き換えずに、設定側で次のように扱う。
 * - 改名: 旧名を aliases に残す。旧名の取引も同じ役割・色・今の名前で集計する
 * - 使用中の削除: 消さずに archived にする。入力の選択肢からは消え、役割と色は残る
 * - 使われていない削除: 従来どおり消す
 */
import { CategorySetting, SubcategorySetting } from '@/types';

/** 取引で使われているか。subcategoryNames を渡したときはサブカテゴリまで一致するもの */
export type UsageCheck = (categoryNames: string[], subcategoryNames?: string[]) => boolean;

/** 以前の名前に oldName を足す。今の名前と同じものは外す（元の名前に戻したとき） */
const nextAliases = (
  aliases: string[] | undefined,
  oldName: string | undefined,
  newName: string
): string[] => {
  const list = [...(aliases ?? [])];
  if (oldName !== undefined && oldName !== newName && !list.includes(oldName)) list.push(oldName);
  return list.filter((name) => name !== newName);
};

/** 空の aliases と archived: false は持たない（保存データを増やさない） */
const withMeta = <T extends { aliases?: string[]; archived?: boolean }>(
  item: T,
  aliases: string[],
  archived: boolean
): T => {
  const rest = { ...item };
  delete rest.aliases;
  delete rest.archived;
  return {
    ...rest,
    ...(aliases.length > 0 ? { aliases } : {}),
    ...(archived ? { archived: true } : {}),
  };
};

/** その名前で記録された取引がありうる名前（今の名前 + 以前の名前） */
export const namesOf = (item: { name: string; aliases?: string[] }): string[] => [
  item.name,
  ...(item.aliases ?? []),
];

/**
 * 編集モーダルで保存されたカテゴリを、以前の名前とアーカイブを保って確定する
 *
 * @param previous 編集前のカテゴリ（新規作成なら undefined）。アーカイブ済みのサブカテゴリも含む
 * @param edited モーダルが返したカテゴリ（アーカイブ済みのサブカテゴリは含まない）
 */
export const applyCategoryEdit = (
  previous: CategorySetting | undefined,
  edited: CategorySetting,
  isUsed: UsageCheck
): CategorySetting => {
  const categoryAliases = nextAliases(previous?.aliases, previous?.name, edited.name);
  const categoryNames = [edited.name, ...categoryAliases];

  const previousSubs = new Map((previous?.subcategories ?? []).map((sub) => [sub.id, sub]));
  const subcategories: SubcategorySetting[] = edited.subcategories.map((sub) => {
    const before = previousSubs.get(sub.id);
    return withMeta(sub, nextAliases(before?.aliases, before?.name, sub.name), false);
  });

  // モーダルで消されたサブカテゴリ（と、もともとアーカイブ済みのもの）。
  // 取引で使われていればアーカイブとして残す。同じ名前のサブカテゴリを
  // 新しく作った場合は、そちらに引き継ぐ
  const editedIds = new Set(subcategories.map((sub) => sub.id));
  const currentSubNames = new Set(subcategories.map((sub) => sub.name));
  for (const before of previous?.subcategories ?? []) {
    if (editedIds.has(before.id) || currentSubNames.has(before.name)) continue;
    if (!isUsed(categoryNames, namesOf(before))) continue;
    subcategories.push(withMeta(before, before.aliases ?? [], true));
  }

  return withMeta(
    { ...edited, subcategories },
    categoryAliases,
    previous?.archived ?? false
  );
};

/** 削除。取引で使われていればアーカイブにする */
export const removeCategory = (
  list: CategorySetting[],
  category: CategorySetting,
  isUsed: UsageCheck
): CategorySetting[] =>
  isUsed(namesOf(category))
    ? list.map((c) => (c.id === category.id ? withMeta(c, c.aliases ?? [], true) : c))
    : list.filter((c) => c.id !== category.id);

/** アーカイブから戻す */
export const restoreCategory = (list: CategorySetting[], id: string): CategorySetting[] =>
  list.map((c) => (c.id === id ? withMeta(c, c.aliases ?? [], false) : c));

/** 入力の選択肢に出すカテゴリ（アーカイブを除く） */
export const activeCategories = (list: CategorySetting[]): CategorySetting[] =>
  list
    .filter((c) => !c.archived)
    .map((c) =>
      c.subcategories.some((sub) => sub.archived)
        ? { ...c, subcategories: c.subcategories.filter((sub) => !sub.archived) }
        : c
    );

/** 編集モーダルに渡すカテゴリ（アーカイブ済みのサブカテゴリは編集対象にしない） */
export const editableCategory = (category: CategorySetting): CategorySetting => ({
  ...category,
  subcategories: category.subcategories.filter((sub) => !sub.archived),
});
