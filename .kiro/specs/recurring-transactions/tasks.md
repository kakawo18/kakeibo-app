# 定期取引機能 実装タスク

- [x] 1. データ型とFirestore構造の準備












  - [x] 1.1 RecurringTransaction型をsrc/types/index.tsに追加







  - [x] 1.2 Firestoreセキュリティルールを更新（recurringTransactionsコレクション）








  - _Requirements: 1.1, 1.4, 6.1, 6.2, 6.3, 6.4_
























- [x] 2. useRecurringTransactions フックの実装









  - [x] 2.1 基本的なCRUD操作を実装（add, update, delete）




  - [x] 2.2 リアルタイムリスナーを実装









  - [ ] 2.3 getActiveRecurringTransactions()メソッドを実装
  - [ ] 2.4 shouldShowRecurringTransaction()メソッドを実装（今日 >= 実行日の判定）
  - [ ] 2.5 エラーハンドリングを実装
  - _Requirements: 1.4, 2.4, 3.1, 3.4, 3.5, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 3. RecurringTransactionForm コンポーネントの実装
  - [ ] 3.1 フォームの基本構造を作成（名前、金額、カテゴリ、サブカテゴリ、支払方法、実行日）
  - [ ] 3.2 モバイル対応（NativeSelect、タップ領域48px、フォント16px）
  - [ ] 3.3 バリデーションを実装（金額 > 0、実行日 1-31、必須項目チェック）
  - [ ] 3.4 新規作成と編集の両方に対応
  - [ ] 3.5 保存処理を実装（useRecurringTransactionsフックを使用）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 7.1, 7.2, 7.3, 7.4_

- [ ] 4. RecurringTransactionManager コンポーネントの実装
  - [ ] 4.1 定期取引の一覧表示を実装
  - [ ] 4.2 新規作成ボタンとフォーム表示を実装
  - [ ] 4.3 編集ボタンとフォーム表示を実装
  - [ ] 4.4 削除ボタンと確認ダイアログを実装
  - [ ] 4.5 有効/無効トグルスイッチを実装
  - [ ] 4.6 モバイル対応（全画面表示）
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 7.1_

- [ ] 5. RecurringTransactionConfirm コンポーネントの実装
  - [ ] 5.1 確認画面の基本構造を作成
  - [ ] 5.2 定期取引の情報を入力済み状態で表示
  - [ ] 5.3 全項目を編集可能にする（金額、カテゴリ、サブカテゴリ、支払方法）
  - [ ] 5.4 日付を実行日で固定（編集不可）
  - [ ] 5.5 メモ欄を空欄で提供
  - [ ] 5.6 記録ボタンで取引を作成（useTransactionsフックを使用）
  - [ ] 5.7 モバイル対応（全画面表示）
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 7.5_

- [ ] 6. RecurringTransactionNotice コンポーネントの実装
  - [ ] 6.1 ダッシュボード用の通知セクションを作成
  - [ ] 6.2 表示すべき定期取引をフィルタリング（shouldShowRecurringTransaction使用）
  - [ ] 6.3 各定期取引の情報を表示（名前、実行日、金額、カテゴリ）
  - [ ] 6.4 記録ボタンを実装（RecurringTransactionConfirmを開く）
  - [ ] 6.5 表示すべき定期取引がない場合は非表示
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 7. DashboardContent の更新
  - [ ] 7.1 RecurringTransactionNoticeコンポーネントを追加
  - [ ] 7.2 テンプレートボタンを定期取引ボタンに置き換え
  - [ ] 7.3 定期取引ボタンのクリックでRecurringTransactionManagerを開く
  - [ ] 7.4 モバイル用フローティングボタンを更新
  - _Requirements: 3.1, 5.1_

- [ ] 8. テンプレート機能の削除
  - [ ] 8.1 TemplateSelectorコンポーネントを削除
  - [ ] 8.2 useTransactionTemplatesフックを削除
  - [ ] 8.3 TransactionFormからテンプレート関連の機能を削除
  - [ ] 8.4 DashboardContentからテンプレート関連のimportと状態を削除
  - [ ] 8.5 types/index.tsからTransactionTemplate型を削除（任意）
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 9. エラーハンドリングと通知
  - [ ] 9.1 保存失敗時のエラー通知を実装
  - [ ] 9.2 削除失敗時のエラー通知を実装
  - [ ] 9.3 バリデーションエラーの表示を実装
  - [ ] 9.4 成功時の通知を実装（作成、更新、削除、記録）
  - _Requirements: 1.4, 2.4, 4.6_

- [ ] 10. 統合テストと動作確認
  - [ ] 10.1 定期取引の作成から記録までの一連の流れをテスト
  - [ ] 10.2 編集・削除機能をテスト
  - [ ] 10.3 有効/無効の切り替えをテスト
  - [ ] 10.4 モバイルデバイスでの動作をテスト
  - [ ] 10.5 複数の定期取引を作成してテスト
  - [ ] 10.6 日付判定ロジックをテスト（今日 >= 実行日）
  - _Requirements: 全て_
