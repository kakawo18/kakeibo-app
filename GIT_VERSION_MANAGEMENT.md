# Git & GitHub バージョン管理ガイド

## 概要

このドキュメントは、家計簿アプリの開発において、GitHubを使用したバージョン管理の詳細な手順を説明します。機能追加や修正を安全に行い、必要に応じて以前のバージョンに戻すことができるようにします。

## 現在のプロジェクト状況

- **リポジトリ**: https://github.com/kakawo18/kakeibo-app.git
- **メインブランチ**: main
- **現在のバージョン**: v1.0.0（デプロイメント完了版）

## バージョン管理戦略

### 1. ブランチ戦略（Feature Branch Strategy）

#### ブランチ構成
- **main**: 本番環境デプロイ用の安定ブランチ
- **feature/機能名**: 新機能開発用ブランチ
- **hotfix/修正名**: 緊急修正用ブランチ

#### 命名規則
- 新機能: `feature/mobile-optimization`
- バグ修正: `bugfix/subcategory-freeze`
- 緊急修正: `hotfix/production-issue`

### 2. セマンティックバージョニング

#### バージョン番号の形式
`MAJOR.MINOR.PATCH` (例: v1.2.3)

- **MAJOR**: 破壊的変更
- **MINOR**: 新機能追加（後方互換性あり）
- **PATCH**: バグ修正

#### 現在の計画
- v1.0.0: 現在の安定版（デプロイ済み）
- v1.1.0: モバイル最適化とパフォーマンス改善
- v1.2.0: 将来の機能追加

## 実装前の準備作業

### 1. 現在の状態を安全にタグ付け

```bash
# 現在の安定版をタグ付け
git tag -a v1.0.0 -m "Production stable version - Initial deployment"
git push origin v1.0.0
```

### 2. 新機能開発ブランチの作成

```bash
# 新機能開発用ブランチを作成
git checkout -b feature/mobile-optimization

# GitHubにブランチをプッシュ
git push -u origin feature/mobile-optimization
```

## 開発フロー

### 1. 機能開発フロー

#### Step 1: 作業開始
```bash
# 最新のmainブランチに切り替え
git checkout main

# 最新の変更を取得
git pull origin main

# 新しい機能ブランチを作成
git checkout -b feature/performance-optimization
```

#### Step 2: 開発作業
```bash
# 変更を確認
git status
git diff

# 変更をステージング
git add .

# コミット（詳細なメッセージ）
git commit -m "feat: TransactionFormにuseMemoを追加してパフォーマンス最適化

- サブカテゴリ計算のメモ化
- 不要な再レンダリング削減
- モバイル環境での応答性向上"

# GitHubにプッシュ
git push origin feature/performance-optimization
```

#### Step 3: Pull Request作成
```bash
# GitHub CLIを使用してPull Requestを作成
gh pr create --title "feat: モバイル環境でのパフォーマンス最適化" --body "
## 概要
スマートフォンでサブカテゴリ選択時にフリーズする問題を解決

## 変更内容
- TransactionFormコンポーネントにuseMemoを追加
- サブカテゴリ計算の最適化
- フォーム状態管理の改善

## テスト
- [ ] デスクトップ環境での動作確認
- [ ] モバイル環境での動作確認
- [ ] 既存機能の回帰テスト

## 影響範囲
- TransactionFormコンポーネント
- パフォーマンスの改善のみ、機能変更なし
"
```

### 2. 本番環境への反映

#### Step 1: マージ前の確認
```bash
# mainブランチに最新の変更を確認
git checkout main
git pull origin main

# 機能ブランチをmainにマージ（テスト目的）
git merge feature/performance-optimization --no-ff
```

#### Step 2: 本番反映
```bash
# バージョンタグを作成
git tag -a v1.1.0 -m "Performance optimization for mobile devices

- Fixed subcategory selection freeze on mobile
- Improved rendering performance with useMemo
- Enhanced form state management"

# GitHubにプッシュ
git push origin main
git push origin v1.1.0
```

## 緊急ロールバック手順

### 1. 問題発生時の対応

#### 即座に前のバージョンに戻す
```bash
# 現在のコミットを確認
git log --oneline -n 5

# 前のバージョンに戻す（Hard Reset）
git reset --hard v1.0.0

# 強制プッシュ（注意！）
git push origin main --force
```

#### より安全な方法（Revert）
```bash
# 問題のあるコミットをrevert
git revert HEAD

# 変更をプッシュ
git push origin main
```

### 2. 段階的なロールバック

#### 特定の機能のみ無効化
```bash
# 特定のファイルを前のバージョンに戻す
git checkout v1.0.0 -- src/components/forms/TransactionForm.tsx

# 変更をコミット
git commit -m "rollback: TransactionFormを安定版に戻す"

# プッシュ
git push origin main
```

## 日常的な運用

### 1. 定期的なバックアップ

#### 重要なポイントでのスナップショット
```bash
# 機能完成時
git tag -a v1.1.0-rc1 -m "Release candidate - mobile optimization"

# 本番デプロイ前
git tag -a v1.1.0-pre-deploy -m "Pre-deployment snapshot"

# 本番デプロイ後
git tag -a v1.1.0 -m "Production deployment"
```

### 2. ブランチの管理

#### 不要なブランチの削除
```bash
# ローカルブランチ削除
git branch -d feature/performance-optimization

# リモートブランチ削除
git push origin --delete feature/performance-optimization
```

#### ブランチの状況確認
```bash
# すべてのブランチを確認
git branch -a

# マージ済みブランチを確認
git branch --merged main
```

## トラブルシューティング

### 1. よくある問題と解決法

#### コンフリクトの解決
```bash
# コンフリクト発生時
git status
git diff

# 手動でコンフリクトを解決後
git add .
git commit -m "resolve: マージコンフリクトを解決"
```

#### 間違ったコミットの修正
```bash
# 最後のコミットを修正
git commit --amend -m "修正されたコミットメッセージ"

# まだプッシュしていない場合のみ
git push origin feature/branch-name --force
```

### 2. 緊急時の連絡手順

1. **問題の確認**: 何が問題かを特定
2. **即座の対応**: 必要に応じて前のバージョンに戻す
3. **原因調査**: 問題の根本原因を調査
4. **修正版の準備**: 修正版を別ブランチで準備
5. **テスト**: 十分なテストを実施
6. **再デプロイ**: 修正版をデプロイ

## GitHub Actions（将来的な自動化）

### 1. 基本的なCI/CDワークフロー（参考）

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm run test
      - name: Run lint
        run: npm run lint
      - name: Run type check
        run: npm run type-check
```

## 重要な注意事項

### 1. 絶対に避けるべき操作

❌ **mainブランチでの直接作業**
```bash
# これはダメ
git checkout main
# 直接編集...
git commit -m "直接main編集"
```

✅ **正しい方法**
```bash
# 正しい方法
git checkout -b feature/new-feature
# 編集作業...
git commit -m "新機能追加"
```

❌ **履歴の書き換え（本番環境）**
```bash
# 本番環境では避ける
git rebase -i HEAD~3
git push --force
```

### 2. 安全な作業のためのチェックリスト

- [ ] 作業前に必ず最新のmainブランチから新しいブランチを作成
- [ ] 重要な変更前にバックアップタグを作成
- [ ] コミットメッセージは詳細に記述
- [ ] Pull Requestでコードレビューを実施
- [ ] 本番デプロイ前にステージング環境でテスト
- [ ] デプロイ後の動作確認を実施

## まとめ

このガイドラインに従うことで、以下のメリットが得られます：

1. **安全性**: 問題発生時の迅速な復旧
2. **追跡性**: 変更履歴の完全な記録
3. **協調性**: チーム開発での効率的な作業
4. **品質管理**: 段階的なテストとレビュー

バージョン管理は継続的な改善プロセスです。このガイドを基に、プロジェクトの成長に合わせて適切に調整していきましょう。