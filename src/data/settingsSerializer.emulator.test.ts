/**
 * 設定の部分更新が、他の端末の変更を上書きしないことを確かめる（#104）
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  RulesTestEnvironment,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Firestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { testSettings } from '@/test/fixtures';
import {
  deserializeSettings,
  serializeSettings,
  toSettingsPatchData,
} from '@/data/settingsSerializer';

const UID = 'alice';
let env: RulesTestEnvironment;
let db: Firestore;
const settingsRef = () => doc(db, 'users', UID, 'settings', 'app');

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kakeibo',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  db = env.authenticatedContext(UID).firestore() as unknown as Firestore;
  await assertSucceeds(setDoc(settingsRef(), serializeSettings(testSettings)));
});

afterAll(async () => {
  await env?.cleanup();
});

describe('設定の部分更新', () => {
  it('端末A が予算を変えた後、古い設定を持つ端末B がグラフ設定を保存しても予算は消えない', async () => {
    // 端末A: 予算を変更
    await assertSucceeds(updateDoc(settingsRef(), toSettingsPatchData({ monthlyBudget: 250_000 }, new Date())));
    // 端末B: まだ予算 100,000 の設定を持っている。グラフの選択だけ保存する
    await assertSucceeds(
      updateDoc(
        settingsRef(),
        toSettingsPatchData({ chartPreferences: { categoryTrendCategories: ['食費'] } }, new Date())
      )
    );

    const saved = deserializeSettings((await getDoc(settingsRef())).data()!);
    expect(saved.monthlyBudget).toBe(250_000);
    expect(saved.chartPreferences?.categoryTrendCategories).toEqual(['食費']);
    expect(saved.categories).toHaveLength(testSettings.categories.length);
  });

  it('端末A がカテゴリを足した後、端末B が予算を変えてもカテゴリは消えない', async () => {
    const added = [
      ...testSettings.categories,
      { ...testSettings.categories[0], id: 'new', name: '新しいカテゴリ' },
    ];
    await assertSucceeds(updateDoc(settingsRef(), toSettingsPatchData({ categories: added }, new Date())));
    await assertSucceeds(updateDoc(settingsRef(), toSettingsPatchData({ monthlyBudget: 90_000 }, new Date())));

    const saved = deserializeSettings((await getDoc(settingsRef())).data()!);
    expect(saved.categories.map((c) => c.name)).toContain('新しいカテゴリ');
    expect(saved.monthlyBudget).toBe(90_000);
  });

  it('グラフ設定のドット区切りパスで書いても、既存の chartPreferences の他の項目は残る', async () => {
    await assertSucceeds(updateDoc(settingsRef(), { 'chartPreferences.someOtherKey': 'keep' }));
    await assertSucceeds(
      updateDoc(settingsRef(), toSettingsPatchData({ chartPreferences: { categoryTrendCategories: ['食費'] } }, new Date()))
    );
    const raw = (await getDoc(settingsRef())).data()!;
    expect(raw.chartPreferences).toEqual({ someOtherKey: 'keep', categoryTrendCategories: ['食費'] });
  });
});
