# 家計簿アプリ

個人向けの家計簿 PWA。Next.js（App Router）+ Mantine + Firebase 製。収支の記録、カテゴリ別の可視化、定期取引、クレジットカードの引き落としタイミングを考慮した残高管理などができる。

## クイックスタート

```bash
npm install
cp .env.example .env.local   # Firebase の設定値を記入
npm run dev                  # http://localhost:3000
```

詳しい手順は [`docs/setup.md`](docs/setup.md)。

## ドキュメント

- [`AGENTS.md`](AGENTS.md) — コーディングエージェント向けの作業ガイド（規約・コマンド・注意点）
- [`docs/`](docs/) — 構成・セットアップ・デプロイ・使い方・変更履歴

## スクリプト

| コマンド | 内容 |
|----------|------|
| `npm run dev` | 開発サーバー（Turbopack） |
| `npm run build` | 本番ビルド |
| `npm run lint` | ESLint |
| `npm run type-check` | 型チェック（`tsc --noEmit`） |
