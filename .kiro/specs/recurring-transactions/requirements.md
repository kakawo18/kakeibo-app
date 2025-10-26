# 定期取引機能 要件定義

## Introduction

家計簿アプリに定期取引機能を追加します。家賃や投資など、毎月決まった日に決まった金額が発生する取引を事前に登録し、該当日になったらワンタップで記録できるようにします。この機能により、固定費の入力忘れを防ぎ、入力作業を効率化します。

また、既存のテンプレート機能は使用されていないため、完全に削除し、定期取引機能に置き換えます。

## Glossary

- **定期取引（Recurring Transaction）**: 毎月決まった日に発生する取引の設定
- **実行日（Execution Day）**: 定期取引が実行される日（1〜31日）
- **記録（Record）**: 定期取引の情報を元に実際の取引データを作成すること
- **確認画面（Confirmation Screen）**: 記録前に定期取引の内容を確認・編集する画面
- **System**: 家計簿Webアプリケーション

## Requirements

### Requirement 1: 定期取引の登録

**User Story:** ユーザーとして、毎月決まった日に発生する取引を事前に登録したい。そうすることで、毎月の入力作業を効率化できる。

#### Acceptance Criteria

1. WHEN ユーザーが「定期取引」ボタンをタップ, THEN THE System SHALL 定期取引管理画面を表示する
2. WHEN ユーザーが「新しい定期取引を追加」をタップ, THEN THE System SHALL 定期取引作成フォームを表示する
3. THE System SHALL 以下の項目を入力可能にする: 名前、金額、カテゴリ、サブカテゴリ、支払方法、実行日（1〜31日）
4. WHEN ユーザーが定期取引を保存, THEN THE System SHALL Firestoreに定期取引データを保存する
5. THE System SHALL 定期取引を有効状態で作成する

### Requirement 2: 定期取引の管理

**User Story:** ユーザーとして、登録した定期取引を編集・削除・無効化したい。そうすることで、状況の変化に対応できる。

#### Acceptance Criteria

1. THE System SHALL 定期取引管理画面に全ての定期取引を一覧表示する
2. WHEN ユーザーが定期取引の編集ボタンをタップ, THEN THE System SHALL 編集フォームを表示する
3. THE System SHALL 定期取引の全ての項目を編集可能にする
4. WHEN ユーザーが定期取引を削除, THEN THE System SHALL Firestoreから定期取引データを削除する
5. THE System SHALL 定期取引の有効/無効を切り替えるトグルスイッチを提供する
6. WHEN 定期取引が無効, THEN THE System SHALL ダッシュボードに表示しない

### Requirement 3: ダッシュボードでの表示

**User Story:** ユーザーとして、今月記録すべき定期取引をダッシュボードで確認したい。そうすることで、記録忘れを防げる。

#### Acceptance Criteria

1. WHEN 今日の日付が実行日以上, THEN THE System SHALL ダッシュボードに「今月の定期取引」セクションを表示する
2. THE System SHALL 各定期取引について名前、実行日、金額、カテゴリ情報を表示する
3. THE System SHALL 各定期取引に「記録する」ボタンを表示する
4. WHEN 表示すべき定期取引が存在しない, THEN THE System SHALL 「今月の定期取引」セクションを表示しない
5. THE System SHALL 有効な定期取引のみを表示する

### Requirement 4: 定期取引の記録

**User Story:** ユーザーとして、定期取引をワンタップで記録したい。そうすることで、金額を確認しながら素早く入力できる。

#### Acceptance Criteria

1. WHEN ユーザーが「記録する」ボタンをタップ, THEN THE System SHALL 専用の確認画面をモーダルで表示する
2. THE System SHALL 確認画面に定期取引の全ての情報を入力済み状態で表示する
3. THE System SHALL 金額、カテゴリ、サブカテゴリ、支払方法を編集可能にする
4. THE System SHALL 日付を実行日で固定し編集不可にする
5. THE System SHALL メモ欄を空欄で提供する
6. WHEN ユーザーが「記録する」ボタンをタップ, THEN THE System SHALL 実行日の日付で取引データを作成する
7. THE System SHALL 複数回の記録を許可する（重複チェックを行わない）

### Requirement 5: テンプレート機能の削除

**User Story:** ユーザーとして、使用していないテンプレート機能を削除し、定期取引機能に置き換えたい。そうすることで、UIがシンプルになり使いやすくなる。

#### Acceptance Criteria

1. THE System SHALL ヘッダーの「テンプレート」ボタンを「定期取引」ボタンに置き換える
2. THE System SHALL テンプレート管理画面を削除する
3. THE System SHALL テンプレート関連のコンポーネントを削除する
4. THE System SHALL テンプレート関連のフックを削除する
5. THE System SHALL 取引フォームからテンプレート関連の機能を削除する

### Requirement 6: データの永続化

**User Story:** ユーザーとして、定期取引のデータが永続的に保存されることを期待する。そうすることで、アプリを再起動しても設定が保持される。

#### Acceptance Criteria

1. THE System SHALL 定期取引データをFirestoreの `users/{userId}/recurringTransactions` コレクションに保存する
2. THE System SHALL 定期取引の作成時にタイムスタンプを記録する
3. THE System SHALL 定期取引の更新時にタイムスタンプを更新する
4. THE System SHALL ユーザーごとに定期取引を分離して管理する
5. THE System SHALL リアルタイムでデータの変更を反映する

### Requirement 7: モバイル対応

**User Story:** ユーザーとして、モバイルデバイスで定期取引機能を快適に使用したい。そうすることで、外出先でも管理できる。

#### Acceptance Criteria

1. THE System SHALL モバイルデバイスで定期取引管理画面を全画面表示する
2. THE System SHALL モバイルデバイスでNativeSelectを使用する
3. THE System SHALL タップ領域を48px以上確保する
4. THE System SHALL フォントサイズを16px以上にする
5. THE System SHALL 確認画面をモバイルデバイスで全画面表示する
