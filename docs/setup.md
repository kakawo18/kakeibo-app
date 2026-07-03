# 開発環境セットアップ

前提: Node.js（LTS）と npm が入っていること。

## 1. 依存インストール

```bash
npm install
```

`postinstall` で `npm run type-check` が自動実行される。

## 2. Firebase プロジェクトの準備

このアプリは認証とデータ保存に Firebase を使う。自分の Firebase プロジェクトが必要。

1. [Firebase Console](https://console.firebase.google.com/) で新規プロジェクトを作成
2. **Authentication** → 「始める」→ ログイン方法で **メール/パスワード** を有効化
3. **Firestore Database** → データベースを作成（本番モード。ルールは `docs/deployment.md` を参照）
4. プロジェクト設定（歯車）→「全般」→「マイアプリ」→ ウェブアプリを追加し `firebaseConfig` を控える

## 3. 環境変数

`.env.example` を `.env.local` にコピーし、手順 2 の値に置き換える。

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

`.env.local` はコミットしない（`.gitignore` 済み）。

## 4. 起動と検証

```bash
npm run dev          # http://localhost:3000
npm run type-check   # 型チェック
npm run lint         # Lint
npm run build        # 本番ビルドの確認
```

## Firebase エミュレータ（任意）

ローカルのエミュレータに接続して実データを触らずに開発できる。`.env.local` に以下を追加:

```
NEXT_PUBLIC_FIREBASE_EMULATOR=1
```

接続先ポートは `firebase.json`（Auth: 9099 / Firestore: 8080）。`src/lib/firebase.ts` がこのフラグを見てエミュレータへ接続する。

## トラブルシューティング

**正しいメール/パスワードでログインできない（`auth/invalid-credential`）**
アカウントは Firebase プロジェクトごとに独立している。`.env.local` の `NEXT_PUBLIC_FIREBASE_PROJECT_ID` が、そのアカウントを登録したプロジェクトと一致しているか確認する。別プロジェクトに切り替えた場合はログイン画面の「新規登録」から作り直す。

**依存関係のエラー**
`node_modules` と `package-lock.json` を削除して `npm install` し直す。
