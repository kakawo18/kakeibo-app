# Git操作完全手順書

## 概要
この手順書では、GitHubを使った開発ワークフローを学習するための詳細な手順を説明します。
フィーチャーブランチでの開発からプルリクエスト作成、マージ、Vercelへの自動デプロイまでの一連の流れを網羅しています。

## 前提条件
- 現在のブランチ: `main`
- 変更済みファイル: 3つ（既にコミット済み）
- GitHub連携: 設定済み
- Vercel連携: 設定済み

## 手順1: 現在の状況確認

```bash
# 現在のブランチとリモートの状況を確認
git status
git log --oneline -3
git remote -v
```

**期待する出力:**
```
On branch main
Your branch is ahead of 'origin/main' by 1 commit.
```

## 手順2: 新しいfeatureブランチを作成

```bash
# 新しいブランチを作成して切り替える
git checkout -b feature/category-improvements

# または git switch -c でも同じ意味（Git 2.23以降）
# git switch -c feature/category-improvements

# ブランチが切り替わったことを確認
git branch
```

**期待する出力:**
```
* feature/category-improvements
  main
```

## 手順3: 変更を新しいブランチに移動

### 方法A: reset & cherry-pickを使用

```bash
# 現在のmainブランチの最新コミットを確認
git log --oneline -1

# このコミットを新しいブランチに移動するため、mainブランチから取り消す
git checkout main
git reset --hard HEAD~1

# 変更を新しいブランチに適用
git checkout feature/category-improvements
git cherry-pick 7501d99
```

### 方法B: より簡単な方法（推奨）

```bash
# 現在のmainブランチから新しいブランチを作成
git checkout -b feature/category-improvements

# mainブランチを1つ前のコミットに戻す
git checkout main
git reset --hard HEAD~1

# 新しいブランチに戻る
git checkout feature/category-improvements
```

## 手順4: GitHubにfeatureブランチをプッシュ

```bash
# 新しいブランチをGitHubにプッシュ
git push origin feature/category-improvements

# 初回プッシュ時は上流ブランチを設定
git push -u origin feature/category-improvements
```

**期待する出力:**
```
To https://github.com/kakawo18/kakeibo-app.git
 * [new branch]      feature/category-improvements -> feature/category-improvements
Branch 'feature/category-improvements' set up to track remote branch 'feature/category-improvements' from 'origin'.
```

## 手順5: GitHubでプルリクエストを作成

### 方法1: GitHub Web UIで作成

1. GitHubのリポジトリページにアクセス
2. 「Compare & pull request」ボタンをクリック
3. プルリクエストの詳細を入力:

```markdown
## 概要
カテゴリ表示とクレジットカード支払い管理の改善

## 変更内容
- [ ] カード引き落としカテゴリを削除
- [ ] 「その他」カテゴリの表示を支払方法に関係なく統合  
- [ ] クレジットカード支払い合計の表示機能を追加（5社カード対応）

## 技術的な変更点
- `src/types/index.ts`: EXPENSE_CATEGORIESからカード引き落とし削除
- `src/utils/calculations.ts`: 「その他」カテゴリの表示ロジック改善
- `src/components/ui/DashboardContent.tsx`: クレジットカード支払い合計表示追加

## テスト方法
1. 取引フォームでカテゴリ選択時に「カード引き落とし」が表示されないことを確認
2. 「その他」カテゴリで支払方法が異なる取引が統合表示されることを確認
3. ダッシュボードでクレジットカード支払い合計が表示されることを確認

## 影響範囲
- フロントエンドUI: カテゴリ選択とダッシュボード表示
- データ処理: カテゴリ集計ロジック
- ユーザー体験: より直感的なカテゴリ管理
```

### 方法2: GitHub CLI（gh）で作成

```bash
# GitHub CLIをインストール（まだの場合）
# Windows: winget install GitHub.cli
# Mac: brew install gh
# Linux: sudo apt install gh

# GitHubにログイン
gh auth login

# プルリクエストを作成
gh pr create --title "feat: カテゴリ表示とクレジットカード支払い管理の改善" --body "$(cat <<'EOF'
## 概要
カテゴリ表示とクレジットカード支払い管理の改善

## 変更内容
- カード引き落としカテゴリを削除
- 「その他」カテゴリの表示を支払方法に関係なく統合
- クレジットカード支払い合計の表示機能を追加（5社カード対応）

## 技術的な変更点
- src/types/index.ts: EXPENSE_CATEGORIESからカード引き落とし削除
- src/utils/calculations.ts: 「その他」カテゴリの表示ロジック改善
- src/components/ui/DashboardContent.tsx: クレジットカード支払い合計表示追加

## テスト方法
1. 取引フォームでカテゴリ選択時に「カード引き落とし」が表示されないことを確認
2. 「その他」カテゴリで支払方法が異なる取引が統合表示されることを確認
3. ダッシュボードでクレジットカード支払い合計が表示されることを確認
EOF
)"
```

## 手順6: プルリクエストをマージ

### 方法1: GitHub Web UIでマージ

1. プルリクエストページで「Files changed」タブで変更内容を確認
2. 「Merge pull request」ボタンをクリック
3. マージオプションを選択:
   - **Create a merge commit**: 通常のマージ（推奨）
   - **Squash and merge**: 複数コミットを1つにまとめる
   - **Rebase and merge**: 履歴を綺麗に保つ

### 方法2: GitHub CLIでマージ

```bash
# プルリクエスト一覧を確認
gh pr list

# プルリクエストをマージ
gh pr merge 1 --merge --delete-branch

# オプション説明:
# --merge: 通常のマージ
# --squash: スカッシュマージ  
# --rebase: リベースマージ
# --delete-branch: マージ後にfeatureブランチを削除
```

**期待する出力:**
```
✓ Merged pull request #1 (feat: カテゴリ表示とクレジットカード支払い管理の改善)
✓ Deleted branch feature/category-improvements
```

## 手順7: ローカルでmainブランチを更新

```bash
# mainブランチに切り替える
git checkout main

# リモートの最新状態を取得
git fetch origin

# リモートのmainブランチをローカルに反映
git pull origin main

# マージされたfeatureブランチを削除
git branch -d feature/category-improvements

# リモートで削除されたブランチをローカルでも削除
git remote prune origin
```

**期待する出力:**
```
Switched to branch 'main'
From https://github.com/kakawo18/kakeibo-app
 * branch            main       -> FETCH_HEAD
Updating abc1234..def5678
Fast-forward
 src/components/ui/DashboardContent.tsx | 25 +++++++++++++++++++++++++
 src/types/index.ts                     |  1 -
 src/utils/calculations.ts              |  4 +++-
 3 files changed, 28 insertions(+), 2 deletions(-)
Deleted branch feature/category-improvements (was def5678).
```

## 手順8: Vercelでの自動デプロイを確認

### 確認方法

#### 1. GitHubでの確認
```bash
# GitHub Actionsの実行状況を確認
gh run list --limit 5

# 特定の実行の詳細を確認
gh run view [実行ID]
```

#### 2. Vercelダッシュボードでの確認
- [vercel.com](https://vercel.com)にログイン
- プロジェクトの「Deployments」タブを確認
- 最新のコミットがデプロイされているかチェック

#### 3. 実際のサイトでの確認
- デプロイされたサイトにアクセス
- 変更内容が反映されているか確認:
  - 取引フォームで「カード引き落とし」カテゴリが削除されている
  - 「その他」カテゴリの表示が統合されている
  - クレジットカード支払い合計が表示されている

## 手順9: 完了確認

```bash
# 最終的な状態を確認
git status
git branch -a
git log --oneline -5
```

**期待する出力:**
```
On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean

* main
  remotes/origin/main

def5678 feat: カテゴリ表示とクレジットカード支払い管理の改善
abc1234 docs: v1.1.0開発記録と技術文書の整備
...
```

## トラブルシューティング

### エラー1: プッシュ時の認証エラー

```bash
# GitHubの認証情報を再設定
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Personal Access Tokenを使用
git remote set-url origin https://[token]@github.com/kakawo18/kakeibo-app.git
```

### エラー2: マージコンフリクト

```bash
# コンフリクトを解決
git status
# 該当ファイルを手動で編集
git add [解決したファイル]
git commit -m "resolve merge conflict"
```

### エラー3: Vercelの自動デプロイが動かない

```bash
# Vercelの設定を確認
gh repo view --web
# Settings → Webhooks → Vercelが設定されているか確認
```

### エラー4: ブランチの切り替えに失敗

```bash
# 未コミットの変更がある場合
git stash
git checkout main
git stash pop
```

## 学習ポイント

### 1. ブランチ戦略
- **mainブランチ**: 常に安定した状態を保つ
- **featureブランチ**: 機能開発専用
- **hotfixブランチ**: 緊急修正用

### 2. プルリクエストの意義
- **コードレビュー**: 品質向上
- **変更履歴の明確化**: 何をなぜ変更したかを記録
- **自動テスト**: CI/CDパイプライン

### 3. 自動デプロイの仕組み
- **GitHubとVercelの連携**: Webhookによる自動実行
- **デプロイ環境の分離**: preview/production環境
- **ロールバック機能**: 問題発生時の迅速な対応

### 4. Git操作のベストプラクティス
- **コミットメッセージの書き方**: 50文字以内の簡潔な要約
- **ブランチ命名規則**: feature/、bugfix/、hotfix/などのプレフィックス
- **定期的なpull**: リモートとの同期を保つ

## 参考リンク

- [Git公式ドキュメント](https://git-scm.com/docs)
- [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow)
- [Vercel Git Integration](https://vercel.com/docs/git)
- [GitHub CLI](https://cli.github.com/)

## 付録: よく使うGitコマンド一覧

```bash
# ブランチ操作
git branch                          # ブランチ一覧
git branch -a                       # リモートブランチ含む一覧
git checkout -b [branch-name]       # ブランチ作成と切り替え
git branch -d [branch-name]         # ブランチ削除

# コミット操作
git add .                           # 全ての変更をステージング
git commit -m "commit message"      # コミット
git commit --amend                  # 直前のコミットを修正

# リモート操作
git push origin [branch-name]       # リモートにプッシュ
git pull origin [branch-name]       # リモートからプル
git fetch origin                    # リモートの状態を取得

# 履歴確認
git log --oneline                   # コミット履歴を1行で表示
git log --graph                     # ブランチの分岐を可視化
git diff                            # 変更内容を確認

# 状態確認
git status                          # 現在の状態を確認
git remote -v                       # リモートリポジトリを確認
```

この手順書に従って、実際のGitワークフローを体験してみてください！