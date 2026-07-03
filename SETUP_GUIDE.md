# 開発環境セットアップガイド

## 前提条件

### 1. Node.js のインストール

#### Windows の場合
1. [Node.js公式サイト](https://nodejs.org/)から LTS版をダウンロード
2. インストーラーを実行してインストール
3. コマンドプロンプトで確認：
```cmd
node --version
npm --version
```

#### または nvm を使用する場合
```bash
# nvmのインストール（プロジェクトルートのスクリプトを使用）
./install_nvm.sh

# Node.js LTS版のインストール
nvm install --lts
nvm use --lts
```

## セットアップ手順

### 1. 依存関係のインストール
```bash
npm install
```

### 2. Firebase プロジェクトの準備

このアプリは認証・データ保存に Firebase を使用します。自分の Firebase プロジェクトが必要です。

1. [Firebase Console](https://console.firebase.google.com/) で新しいプロジェクトを作成
2. **Authentication** → 「始める」→ ログイン方法で **メール/パスワード** を有効化
3. **Firestore Database** → データベースを作成（本番モードで作成し、ルールは後で設定）
4. プロジェクトの設定（歯車アイコン）→「全般」→「マイアプリ」→ ウェブアプリを追加し、`firebaseConfig` の値を控える

### 3. 環境変数の設定
1. `.env.example` をコピーして `.env.local` ファイルを作成
2. 手順2で控えた Firebase の設定値に置き換える

```bash
# .env.local ファイルの例
NEXT_PUBLIC_FIREBASE_API_KEY=your_actual_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### 4. 型チェック
```bash
npm run type-check
```

### 5. リンターチェック
```bash
npm run lint
```

### 6. 開発サーバーの起動
```bash
npm run dev
```

ブラウザで http://localhost:3000 にアクセス

## トラブルシューティング

### Node.js がインストールされていない場合
- Windows: 公式サイトからインストーラーをダウンロード
- macOS: Homebrew を使用 `brew install node`
- Linux: パッケージマネージャーを使用

### 依存関係のエラー
```bash
# node_modules を削除して再インストール
rm -rf node_modules package-lock.json
npm install
```

### 型エラーが発生する場合
```bash
# TypeScript の型定義を更新
npm install --save-dev @types/node @types/react @types/react-dom
```

### Firebase 接続エラー
1. `.env.local` ファイルの設定値を確認
2. Firebase Console でプロジェクト設定を確認
3. 認証ドメインの設定を確認

### 正しいはずのメール/パスワードでログインできない（auth/invalid-credential）
アカウントは **Firebase プロジェクトごとに独立** しています。
`.env.local` の `NEXT_PUBLIC_FIREBASE_PROJECT_ID` が、そのアカウントを登録したプロジェクトと一致しているか確認してください。
別プロジェクトに切り替えた場合は、ログイン画面の「新規登録」からアカウントを作り直す必要があります。

## ビルドとデプロイ

### ローカルビルドテスト
```bash
npm run build
npm start
```

### Vercel デプロイ
1. GitHub にコードをプッシュ
2. Vercel で環境変数を設定
3. 自動デプロイが実行される

詳細は `DEPLOYMENT_GUIDE.md` を参照してください。