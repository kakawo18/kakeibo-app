# デプロイ

Vercel + Firebase 構成。`main` への push で Vercel が本番自動デプロイ、PR ごとにプレビュー環境が作られる。

## 初回セットアップ

1. GitHub にリポジトリを用意して push する（個人用途なので Private 推奨）。
2. [Vercel](https://vercel.com) で「Add New → Project」からリポジトリを Import。Framework は Next.js が自動検出される。
3. **環境変数を設定**（下記）。
4. Deploy。

## Vercel の環境変数

`.env.local` と同じ 6 つを Vercel のプロジェクト設定 → Environment Variables に登録する:

| キー |
|------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` |

## Firebase 側の必須設定

- **Authorized domains**: Firebase Console → Authentication → Settings → Authorized domains に、Vercel が発行した本番ドメイン（例: `kakeibo-app-xxxx.vercel.app`）とカスタムドメインを追加する。追加しないとデプロイ先でログインできない。
- **Firestore セキュリティルール**: 各ユーザーが自分のデータのみ読み書きできるようにする。

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 更新とロールバック

- **更新**: `main` に push すれば Vercel が自動でビルド・デプロイする。
- **ロールバック**: Vercel ダッシュボード → Deployments → 正常だったデプロイを選び「Promote to Production」。

## デプロイ後チェック

- ブラウザ / スマホでアクセスできる
- ログインできる（Authorized domains 設定済み）
- 取引の追加・編集・削除、チャート表示、CSV 入出力、月次ナビゲーションが動く
- データが Firestore に保存される

## トラブルシューティング

- **ビルドエラー**: ローカルで `npm run build` を通してから push する。
- **ログイン/データ取得できない**: Vercel の環境変数と Firebase の Authorized domains を再確認。
- **白画面**: ブラウザ devtools のコンソールでエラー確認（多くは環境変数未設定）。
