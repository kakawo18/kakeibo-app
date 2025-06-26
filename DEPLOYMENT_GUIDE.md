# 家計簿Webアプリ デプロイメント手順書

このドキュメントでは、家計簿Webアプリを無料のWebサーバー（Vercel）に公開し、いつでもスマートフォンやPCからアクセスできるようにする手順を詳しく説明します。

## 🎯 目標
- 家計簿アプリをインターネット上に公開
- スマートフォン・PC両方からアクセス可能
- 完全無料での運用
- 簡単な保守・更新作業

## 📋 必要なもの
- [ ] 現在のアプリコード（準備済み）
- [ ] GitHubアカウント（新規作成OK）
- [ ] Firebaseプロジェクト（現在使用中のもの）
- [ ] インターネット接続
- [ ] Webブラウザ

## 🚀 ステップ1: GitHubアカウント作成とリポジトリ設定

### 1-1. GitHubアカウント作成
1. **Webブラウザで https://github.com にアクセス**
2. **「Sign up」をクリック**
3. **アカウント情報を入力**
   - Username（ユーザー名）: 好きな名前（英数字のみ）
   - Email: あなたのメールアドレス
   - Password: 強力なパスワード
4. **メール認証を完了**

### 1-2. 新しいリポジトリ作成
1. **GitHubにログインした状態で右上の「+」をクリック**
2. **「New repository」を選択**
3. **リポジトリ設定**
   - Repository name: `kakeibo-app`
   - Description: `個人用家計簿Webアプリ`（任意）
   - **Private（プライベート）を選択** ⚠️ 重要
   - 「Add a README file」「Add .gitignore」「Choose a license」は**全てチェックしない**
4. **「Create repository」をクリック**

### 1-3. ローカルコードをGitHubにアップロード
**ターミナル/コマンドプロンプトで以下を順番に実行：**

```bash
# GitHubリポジトリを登録（[ユーザー名]は実際のGitHubユーザー名に置き換え）
git remote add origin https://github.com/[ユーザー名]/kakeibo-app.git

# デフォルトブランチ名を確認・設定
git branch -M main

# コードをGitHubにアップロード
git push -u origin main
```

**例：**
```bash
git remote add origin https://github.com/tanaka123/kakeibo-app.git
git branch -M main
git push -u origin main
```

**⚠️ 注意：** 初回プッシュ時にユーザー名・パスワードまたはトークンの入力を求められる場合があります。

## 🌐 ステップ2: Vercelアカウント作成とデプロイ設定

### 2-1. Vercelアカウント作成
1. **Webブラウザで https://vercel.com にアクセス**
2. **「Start Deploying」または「Sign Up」をクリック**
3. **「Continue with GitHub」を選択**
4. **GitHubアカウントでログイン**
5. **Vercelの権限付与を承認**

### 2-2. リポジトリのインポート
1. **Vercelダッシュボードで「Add New...」→「Project」をクリック**
2. **「Import Git Repository」セクションで `kakeibo-app` を見つける**
3. **「Import」をクリック**

### 2-3. プロジェクト設定
1. **Project Name: `kakeibo-app`（自動入力される）**
2. **Framework Preset: `Next.js`（自動検出される）**
3. **Root Directory: `./`（デフォルト）**
4. **Build and Output Settings: デフォルトのまま**

## 🔑 ステップ3: 環境変数の設定

### 3-1. Firebase設定値の確認
**現在の `.env.local` ファイルから以下の値をコピー：**

```
NEXT_PUBLIC_FIREBASE_API_KEY=xxxxxxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxxxxxxxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxxxxxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxxxxxxxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxxxxxxxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxxxxxxxx
```

### 3-2. Vercelで環境変数を設定
1. **「Configure Project」画面の「Environment Variables」セクション**
2. **以下の6つの環境変数を一つずつ追加：**

| Name（キー） | Value（値） |
|-------------|------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase設定の値 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase設定の値 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase設定の値 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase設定の値 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase設定の値 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase設定の値 |

**追加方法：**
1. Name欄に変数名を入力
2. Value欄に対応する値を入力
3. 「Add」をクリック
4. 6つ全て追加するまで繰り返し

### 3-3. デプロイ実行
1. **「Deploy」ボタンをクリック**
2. **ビルド進行状況を確認（2-3分程度）**
3. **「🎉 Congratulations!」画面が表示されたら成功**

## 🌍 ステップ4: アクセス確認とカスタムドメイン設定

### 4-1. アプリケーションへのアクセス
1. **デプロイ完了画面で「Visit」をクリック**
2. **自動生成されたURL（例：`https://kakeibo-app-abc123.vercel.app`）でアプリが開く**
3. **ログイン機能と全機能の動作を確認**

### 4-2. スマートフォンでのアクセステスト
1. **スマートフォンのブラウザでURLにアクセス**
2. **レスポンシブデザインの確認**
3. **取引追加・編集機能の動作確認**

### 4-3. カスタムドメイン設定（任意）
**独自ドメインを使いたい場合：**
1. **Vercelプロジェクトダッシュボード → 「Settings」 → 「Domains」**
2. **所有するドメインを追加**
3. **DNS設定をVercelの指示に従って変更**

## 🔄 ステップ5: 継続的なアップデート設定

### 5-1. 自動デプロイの確認
**今後のアップデート方法：**
1. **ローカルでコードを修正**
2. **Gitでコミット・プッシュ**
3. **Vercelが自動でデプロイ**

```bash
# コード修正後
git add .
git commit -m "機能追加: ○○機能を実装"
git push origin main
```

### 5-2. ロールバック方法
**問題が発生した場合：**
1. **Vercelダッシュボード → プロジェクト → 「Deployments」**
2. **正常に動作していたバージョンを選択**
3. **「Promote to Production」をクリック**

## 📱 使用方法

### アクセス方法
- **PC**: ブラウザで Vercel URL にアクセス
- **スマートフォン**: ブラウザで同じURLにアクセス
- **ブックマーク**: ホーム画面に追加可能

### ログイン
- **既存アカウント**: 現在のFirebaseアカウントでログイン
- **新規アカウント**: メールアドレスで新規登録

## 🛠 トラブルシューティング

### よくある問題と解決方法

#### 1. ビルドエラーが発生
**症状**: Vercelでデプロイが失敗する
**解決方法**:
```bash
# ローカルでビルドテスト
npm run build

# エラーがあれば修正してから再プッシュ
git add .
git commit -m "ビルドエラー修正"
git push origin main
```

#### 2. Firebaseに接続できない
**症状**: ログインできない、データが表示されない
**解決方法**:
1. **Vercel環境変数の値を再確認**
2. **Firebase Console でドメインを許可リストに追加**
   - Firebase Console → Authentication → Settings → Authorized domains
   - Vercel URL（例：`kakeibo-app-abc123.vercel.app`）を追加

#### 3. 白い画面が表示される
**症状**: アプリが読み込まれない
**解決方法**:
1. **ブラウザの開発者ツールでエラーを確認**
2. **環境変数の設定を再確認**
3. **Firebase設定の確認**

#### 4. GitHubプッシュができない
**症状**: `git push` でエラーが発生
**解決方法**:
```bash
# リモートURLを確認
git remote -v

# HTTPSからSSHに変更（必要に応じて）
git remote set-url origin git@github.com:[ユーザー名]/kakeibo-app.git
```

## 💰 料金について

### Vercel無料プラン制限
- **帯域幅**: 月100GB（個人利用には十分）
- **ビルド時間**: 月6000分
- **ファンクション実行**: 月100GB-Hours
- **プロジェクト数**: 無制限

### Firebase無料プラン制限
- **Firestore**: 日50,000回読み取り、20,000回書き込み
- **Authentication**: 無制限
- **Hosting**: 10GB/月

**💡 個人の家計簿利用では制限に達することはほぼありません**

## 🔒 セキュリティ設定

### 推奨セキュリティ対策
1. **GitHubリポジトリをPrivateに設定**
2. **Firebase Console でセキュリティルールを確認**
3. **定期的なパスワード変更**
4. **不要なアクセス権限の削除**

### Firebase セキュリティルール例
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/transactions/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 📞 サポート

### 問題が解決しない場合
1. **Vercel ドキュメント**: https://vercel.com/docs
2. **Firebase ドキュメント**: https://firebase.google.com/docs
3. **GitHub Issues**: プロジェクトのGitHubリポジトリでissueを作成

### バックアップ・復旧
- **Firebase**: 自動バックアップ
- **コード**: GitHubに保存
- **CSV エクスポート**: アプリ内機能で定期的にバックアップ

---

## ✅ チェックリスト

デプロイ完了後、以下を確認してください：

- [ ] Webブラウザで正常にアクセスできる
- [ ] スマートフォンで正常にアクセスできる
- [ ] ログイン機能が動作する
- [ ] 取引の追加・編集・削除ができる
- [ ] チャートが正しく表示される
- [ ] CSV インポート/エクスポートが動作する
- [ ] 月次ナビゲーションが動作する
- [ ] データが正しく保存される

🎉 **お疲れ様でした！これで家計簿アプリがインターネット上で利用可能になりました。**