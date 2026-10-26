import { test, expect, signUp, chooseOption } from './fixtures';

/**
 * 取引の追加・編集・削除
 *
 * 金額は既定のカテゴリや予算と見分けやすい半端な値にしている。
 * 日付は既定（今日）のままにし、履歴は今月の一覧で確かめる。
 */
test('取引を追加し、履歴で編集・削除できる', async ({ page, account, isMobile }) => {
  await signUp(page, account);

  // ダッシュボードの追加ボタンから支出を記録する
  await page.getByRole('button', { name: '追加', exact: true }).click();
  const form = page.getByRole('dialog');
  await expect(form).toBeVisible();
  await form.getByLabel(/^金額/).fill('12345');
  await chooseOption(page, /^カテゴリ/, '食費', isMobile);
  await form.getByLabel('メモ（任意）').fill('E2E のテスト');
  await form.getByRole('button', { name: '追加', exact: true }).click();
  await expect(form).toBeHidden();

  // 履歴の一覧に出る
  await page.goto('/history');
  const row = page.getByRole('button', { name: '食費 -12,345円を編集' });
  await expect(row).toBeVisible();
  await expect(page.getByText('E2E のテスト')).toBeVisible();

  // 金額を直す
  await row.click();
  const editForm = page.getByRole('dialog');
  await expect(editForm).toBeVisible();
  await editForm.getByLabel(/^金額/).fill('2000');
  await editForm.getByRole('button', { name: '更新' }).click();
  await expect(editForm).toBeHidden();
  await expect(page.getByRole('button', { name: '食費 -2,000円を編集' })).toBeVisible();
  await expect(row).toHaveCount(0);

  // 削除する（確認ダイアログを通す）
  await page.getByRole('button', { name: '食費 2,000円を削除' }).click();
  const confirm = page.getByRole('dialog', { name: '取引を削除' });
  await confirm.getByRole('button', { name: '削除' }).click();
  await expect(page.getByRole('button', { name: '食費 -2,000円を編集' })).toHaveCount(0);

  // 再読み込みしても戻ってこない（Firestore から消えている）
  await page.reload();
  await expect(page.getByRole('button', { name: 'メニュー' })).toBeVisible();
  await expect(page.getByRole('button', { name: /食費 .*円を編集/ })).toHaveCount(0);
});

test('収入を記録すると、ダッシュボードに金額が出る', async ({ page, account, isMobile }) => {
  await signUp(page, account);

  await page.getByRole('button', { name: '追加', exact: true }).click();
  const form = page.getByRole('dialog');
  // SegmentedControl の radio は見えない位置に置かれているので、表示されているラベルを押す
  await form.locator('label').filter({ hasText: /^収入$/ }).click();
  await expect(form.getByRole('radio', { name: '収入' })).toBeChecked();
  await form.getByLabel(/^金額/).fill('321000');
  await chooseOption(page, /^カテゴリ/, '給与', isMobile);
  await form.getByRole('button', { name: '追加', exact: true }).click();
  await expect(form).toBeHidden();

  await expect(page.getByText('321,000').first()).toBeVisible();
});
