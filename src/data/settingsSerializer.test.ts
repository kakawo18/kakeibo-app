import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { testSettings } from '@/test/fixtures';
import {
  deserializeSettings,
  serializeSettings,
  toSettingsPatchData,
} from '@/data/settingsSerializer';

const at = new Date(2026, 8, 27);

describe('toSettingsPatchData（#104: 渡した項目だけを書く）', () => {
  it('グラフの表示設定だけを保存するとき、カテゴリ・予算・支払方法を含めない', () => {
    const data = toSettingsPatchData(
      { chartPreferences: { categoryTrendCategories: ['食費', '固定費'] } },
      at
    );
    expect(Object.keys(data).sort()).toEqual(
      ['chartPreferences.categoryTrendCategories', 'updatedAt'].sort()
    );
    expect(data['chartPreferences.categoryTrendCategories']).toEqual(['食費', '固定費']);
  });

  it('予算だけを保存するとき、配列を含めない', () => {
    const data = toSettingsPatchData({ monthlyBudget: 123_456 }, at);
    expect(data).toEqual({ monthlyBudget: 123_456, updatedAt: Timestamp.fromDate(at) });
  });

  it('カテゴリを保存するときはカテゴリだけ', () => {
    const data = toSettingsPatchData({ categories: testSettings.categories }, at);
    expect(Object.keys(data).sort()).toEqual(['categories', 'updatedAt']);
  });

  it('グラフの選択を空にした（全部外した）ことも保存する', () => {
    const data = toSettingsPatchData({ chartPreferences: { categoryTrendCategories: [] } }, at);
    expect(data['chartPreferences.categoryTrendCategories']).toEqual([]);
  });
});

describe('serializeSettings / deserializeSettings', () => {
  it('往復で内容が変わらない', () => {
    const settings = {
      ...testSettings,
      chartPreferences: { categoryTrendCategories: ['食費'] },
      createdAt: new Date(2026, 0, 1),
      updatedAt: new Date(2026, 0, 2),
    };
    const serialized = serializeSettings(settings);
    // Firestore から読んだときと同じく Timestamp を持つ形にする
    expect(deserializeSettings(serialized)).toEqual(settings);
  });

  it('以前の名前とアーカイブも往復する（#97）', () => {
    const [first, ...rest] = testSettings.categories;
    const settings = {
      ...testSettings,
      categories: [
        {
          ...first,
          aliases: ['食料品'],
          subcategories: [{ ...first.subcategories[0], aliases: ['外食費'], archived: true }],
        },
        { ...rest[0], archived: true },
        ...rest.slice(1),
      ],
      createdAt: new Date(2026, 0, 1),
      updatedAt: new Date(2026, 0, 2),
    };
    const serialized = serializeSettings(settings);
    expect(serialized.categories[0].aliases).toEqual(['食料品']);
    // 持っていない項目は書かない
    expect('aliases' in serialized.categories[2]).toBe(false);
    expect('archived' in serialized.categories[2]).toBe(false);
    expect(deserializeSettings(serialized)).toEqual(settings);
  });
});
