# 🎨 家計簿アプリ - 色変更マニュアル

このマニュアルでは、ダッシュボードやUI部分の色を簡単に変更する方法を説明します。

---

## 📋 目次

1. [ダッシュボードカードの色変更](#ダッシュボードカードの色変更)
2. [グラフの色変更](#グラフの色変更)
3. [ボタンの色変更](#ボタンの色変更)
4. [テーマカラーの変更](#テーマカラーの変更)
5. [ダークモードの色変更](#ダークモードの色変更)

---

## 🎯 ダッシュボードカードの色変更

### ファイル: `src/components/ui/DashboardContent.tsx`

ダッシュボードには8つのカードがあります。各カードの色を変更する方法を説明します。

---

### 1️⃣ 収入カード（緑色）

**場所:** 1行目左

**現在の色:**
- メインカラー: `#4caf50` (緑)
- グラデーション: `rgba(76, 175, 80, 0.05)` → `rgba(76, 175, 80, 0.15)`

**変更箇所:**
```tsx
// 行番号: 約480-490
<Card 
  style={{ 
    background: isDark 
      ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(76, 175, 80, 0.25) 100%)'
      : 'linear-gradient(135deg, rgba(76, 175, 80, 0.05) 0%, rgba(76, 175, 80, 0.15) 100%)',
    borderLeft: '4px solid #4caf50',  // ← ここを変更
    boxShadow: '0 2px 12px rgba(76, 175, 80, 0.1)',  // ← ここも変更
```

**アイコンの色:**
```tsx
// 行番号: 約500-510
style={{
  background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',  // ← ここを変更
  boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',  // ← ここも変更
}}
```

**色の例:**
- 青に変更: `#4caf50` → `#2196f3`
- 紫に変更: `#4caf50` → `#9c27b0`

---

### 2️⃣ 支出カード（赤色）

**場所:** 1行目右

**現在の色:**
- メインカラー: `#f44336` (赤)

**変更箇所:**
```tsx
// 行番号: 約535-545
<Card 
  style={{ 
    background: isDark
      ? 'linear-gradient(135deg, rgba(244, 67, 54, 0.15) 0%, rgba(244, 67, 54, 0.25) 100%)'
      : 'linear-gradient(135deg, rgba(244, 67, 54, 0.05) 0%, rgba(244, 67, 54, 0.15) 100%)',
    borderLeft: '4px solid #f44336',  // ← ここを変更
    boxShadow: '0 2px 12px rgba(244, 67, 54, 0.1)',  // ← ここも変更
```

**アイコンの色:**
```tsx
// 行番号: 約560-570
style={{
  background: 'linear-gradient(135deg, #f44336 0%, #ef5350 100%)',  // ← ここを変更
  boxShadow: '0 4px 12px rgba(244, 67, 54, 0.3)',  // ← ここも変更
}}
```

---

### 3️⃣ 今月の収支カード（青/赤）

**場所:** 2行目左

**現在の色:**
- プラス時: `#2196f3` (青)
- マイナス時: `#f44336` (赤)

**変更箇所:**
```tsx
// 行番号: 約593-605
<Card 
  style={{ 
    background: `linear-gradient(135deg, ${
      (selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0) >= 0 
        ? isDark ? 'rgba(33, 150, 243, 0.15) 0%, rgba(33, 150, 243, 0.25) 100%' 
                 : 'rgba(33, 150, 243, 0.05) 0%, rgba(33, 150, 243, 0.15) 100%'
        : isDark ? 'rgba(244, 67, 54, 0.15) 0%, rgba(244, 67, 54, 0.25) 100%' 
                 : 'rgba(244, 67, 54, 0.05) 0%, rgba(244, 67, 54, 0.15) 100%'
    })`,
    borderLeft: `4px solid ${収支 >= 0 ? '#2196f3' : '#f44336'}`,  // ← ここを変更
```

---

### 4️⃣ 実残高カード（ティール/赤）

**場所:** 2行目右

**現在の色:**
- プラス時: `#009688` (ティール)
- マイナス時: `#f44336` (赤)

**変更箇所:**
```tsx
// 行番号: 約652-665
<Card 
  style={{ 
    background: `linear-gradient(135deg, ${
      (selectedMonthData?.balance || 0) >= 0 
        ? 'rgba(0, 150, 136, 0.05) 0%, rgba(0, 150, 136, 0.15) 100%'
        : 'rgba(244, 67, 54, 0.05) 0%, rgba(244, 67, 54, 0.15) 100%'
    })`,
    borderLeft: `4px solid ${残高 >= 0 ? '#009688' : '#f44336'}`,  // ← ここを変更
```

---

### 5️⃣ カード支払いカード（紫色）

**場所:** 3行目左

**現在の色:**
- メインカラー: `#9c27b0` (紫)

**変更箇所:**
```tsx
// 行番号: 約719-730
<Card 
  style={{ 
    background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.05) 0%, rgba(156, 39, 176, 0.15) 100%)',
    borderLeft: '4px solid #9c27b0',  // ← ここを変更
    boxShadow: '0 2px 12px rgba(156, 39, 176, 0.1)',  // ← ここも変更
```

**アイコンの色:**
```tsx
// 行番号: 約745-755
style={{
  background: 'linear-gradient(135deg, #9c27b0 0%, #ab47bc 100%)',  // ← ここを変更
  boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3)',  // ← ここも変更
}}
```

---

### 6️⃣ 獲得ポイントカード（オレンジ色）

**場所:** 3行目右

**現在の色:**
- メインカラー: `#ff9800` (オレンジ)

**変更箇所:**
```tsx
// 行番号: 約770-780
<Card 
  style={{ 
    background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.05) 0%, rgba(255, 152, 0, 0.15) 100%)',
    borderLeft: '4px solid #ff9800',  // ← ここを変更
    boxShadow: '0 2px 12px rgba(255, 152, 0, 0.1)',  // ← ここも変更
```

---

### 7️⃣ 年間投資額カード（オレンジ色）

**場所:** 4行目左

**現在の色:**
- メインカラー: `#ff9800` (オレンジ)

**変更箇所:**
```tsx
// 行番号: 約820-835
<Card 
  style={{ 
    background: isDark
      ? 'linear-gradient(135deg, rgba(255, 152, 0, 0.15) 0%, rgba(255, 152, 0, 0.25) 100%)'
      : 'linear-gradient(135deg, rgba(255, 152, 0, 0.05) 0%, rgba(255, 152, 0, 0.15) 100%)',
    borderLeft: '4px solid #ff9800',  // ← ここを変更
    boxShadow: '0 2px 12px rgba(255, 152, 0, 0.1)',  // ← ここも変更
```

---

### 8️⃣ 年間貯蓄率カード（紫色）

**場所:** 4行目右

**現在の色:**
- メインカラー: `#9c27b0` (紫)

**変更箇所:**
```tsx
// 行番号: 約865-880
<Card 
  style={{ 
    background: isDark
      ? 'linear-gradient(135deg, rgba(156, 39, 176, 0.15) 0%, rgba(156, 39, 176, 0.25) 100%)'
      : 'linear-gradient(135deg, rgba(156, 39, 176, 0.05) 0%, rgba(156, 39, 176, 0.15) 100%)',
    borderLeft: '4px solid #9c27b0',  // ← ここを変更
    boxShadow: '0 2px 12px rgba(156, 39, 176, 0.1)',  // ← ここも変更
```

---

## 📊 グラフの色変更

### カテゴリの色（円グラフ・折れ線グラフ・取引一覧に共通）

カテゴリごとの色は**アプリ内の設定ページ（/settings）から変更できます**。
カテゴリの編集画面でパレットから色を選択してください（コード変更は不要）。

パレット自体（選択できる色の一覧）を変更したい場合:

**ファイル:** `src/config/colorPalette.ts`

```tsx
export const CATEGORY_PALETTE: CategoryColor[] = [
  { light: '#e34948', dark: '#e66767' }, // レッド
  { light: '#e87ba4', dark: '#d55181' }, // ピンク
  // ...
];
```

各色はライトテーマ用とダークテーマ用のペアで定義されています。
どちらのテーマでも読みやすい色を選んでください。

---

### 折れ線グラフ（LineChart）

**ファイル:** `src/components/charts/LineChart.tsx`

**残高推移の色:**
```tsx
// 行番号: 約85-90
const chartSeries = useMemo(() => {
  if (chartMode === 'balance') {
    return [{ name: '残高', color: 'blue.6' }];  // ← ここを変更
  }
```

**カテゴリ比較の色:**
```tsx
// 行番号: 約92-95
const colors = ['red.6', 'green.6', 'orange.6', 'purple.6', 'teal.6', 'pink.6'];
// ← この配列を変更
```

**Mantineカラー一覧:**
- `blue.6` - 青
- `red.6` - 赤
- `green.6` - 緑
- `orange.6` - オレンジ
- `purple.6` - 紫
- `violet.6` - バイオレット
- `teal.6` - ティール
- `pink.6` - ピンク
- `cyan.6` - シアン
- `lime.6` - ライム

---

## 🔘 ボタンの色変更

### プライマリボタン

**ファイル:** `src/components/ui/DashboardContent.tsx`

**取引追加ボタン:**
```tsx
// 行番号: 約300-310
<Button
  leftSection={<IconPlus size={14} />}
  onClick={() => setTransactionFormOpened(true)}
  // color="blue"  // ← この行を追加して色を変更
>
  取引を追加
</Button>
```

**定期取引ボタン:**
```tsx
// 行番号: 約315-325
<Button
  variant="light"
  leftSection={<IconRepeat size={14} />}
  onClick={() => setRecurringManagerOpened(true)}
  color="orange"  // ← ここを変更
>
  定期取引
</Button>
```

---

## 🎨 テーマカラーの変更

### グローバルテーマ設定

**ファイル:** `src/app/layout.tsx`

**プライマリカラーの変更:**
```tsx
// 行番号: 約14-17
const theme = createTheme({
  primaryColor: 'blue',  // ← ここを変更
  defaultRadius: 'md',
});
```

**選択可能な色:**
- `'blue'` - 青
- `'red'` - 赤
- `'green'` - 緑
- `'orange'` - オレンジ
- `'violet'` - バイオレット
- `'teal'` - ティール
- `'pink'` - ピンク

---

## 🌙 ダークモードの色変更

### グローバルCSS

**ファイル:** `src/app/globals.css`

**ダークモード時の背景色:**
```css
/* 行番号: 約7-12 */
@media (prefers-color-scheme: dark) {
  :root {
    --background: #1a1b1e;  /* ← ページ背景色 */
    --foreground: #e9ecef;  /* ← テキスト色 */
  }
}
```

**カード背景色:**
```css
/* 行番号: 約30-35 */
[data-mantine-color-scheme="dark"] {
  --mantine-color-body: #1a1b1e;      /* ページ背景 */
  --mantine-color-default: #25262b;   /* カード背景 */
  --mantine-color-default-hover: #2c2e33;  /* ホバー時 */
```

**テキスト色:**
```css
/* 行番号: 約37-40 */
  --mantine-color-text: #e9ecef;      /* 通常テキスト */
  --mantine-color-dimmed: #909296;    /* 薄いテキスト */
```

**ボーダー色:**
```css
/* 行番号: 約42-44 */
  --mantine-color-default-border: #373a40;  /* ボーダー */
```

---

## 🎯 色変更の手順

### 1. ファイルを開く
該当するファイルをエディタで開きます。

### 2. 色コードを検索
変更したい色のコード（例: `#4caf50`）を検索します。

### 3. 色を変更
新しい色コードに置き換えます。

### 4. 関連する色も変更
- `borderLeft` の色
- `boxShadow` の色
- `background` のグラデーション色
- アイコンの `background` 色

### 5. 保存して確認
ファイルを保存し、ブラウザで確認します。

---

## 🎨 便利な色コード一覧

### Material Design Colors

| 色名 | ライト | ダーク |
|------|--------|--------|
| 赤 | `#f44336` | `#d32f2f` |
| ピンク | `#e91e63` | `#c2185b` |
| 紫 | `#9c27b0` | `#7b1fa2` |
| 深紫 | `#673ab7` | `#512da8` |
| インディゴ | `#3f51b5` | `#303f9f` |
| 青 | `#2196f3` | `#1976d2` |
| 水色 | `#03a9f4` | `#0288d1` |
| シアン | `#00bcd4` | `#0097a7` |
| ティール | `#009688` | `#00796b` |
| 緑 | `#4caf50` | `#388e3c` |
| 黄緑 | `#8bc34a` | `#689f38` |
| ライム | `#cddc39` | `#afb42b` |
| 黄色 | `#ffeb3b` | `#fbc02d` |
| 琥珀 | `#ffc107` | `#ffa000` |
| オレンジ | `#ff9800` | `#f57c00` |
| 深オレンジ | `#ff5722` | `#e64a19` |

---

## 💡 色変更のヒント

### 1. グラデーションの作り方
```tsx
background: 'linear-gradient(135deg, rgba(R, G, B, 0.05) 0%, rgba(R, G, B, 0.15) 100%)'
```
- `R, G, B` を色コードから計算
- 例: `#4caf50` → `rgba(76, 175, 80, 0.05)`

### 2. RGBAへの変換
- `#4caf50` → `rgb(76, 175, 80)`
- オンラインツール: https://www.rapidtables.com/convert/color/hex-to-rgb.html

### 3. 統一感のある色選び
- 同じ色相で明度を変える
- 補色を使う（色相環で反対側）
- 類似色を使う（色相環で隣）

### 4. アクセシビリティ
- コントラスト比を4.5:1以上に保つ
- チェックツール: https://webaim.org/resources/contrastchecker/

---

## 🔧 トラブルシューティング

### 色が変わらない場合

1. **ブラウザキャッシュをクリア**
   - Ctrl + Shift + R (Windows)
   - Cmd + Shift + R (Mac)

2. **ダークモードの確認**
   - ライトモードとダークモードで別々に設定されている場合があります

3. **複数箇所の変更**
   - 1つの要素に複数の色設定がある場合、すべて変更する必要があります

4. **開発サーバーの再起動**
   ```bash
   npm run dev
   ```

---

## 📝 変更履歴の記録

色を変更したら、このファイルに記録しておくと便利です：

```markdown
## 変更履歴

### 2025-XX-XX
- 収入カードの色を緑から青に変更
  - `#4caf50` → `#2196f3`
  - ファイル: `src/components/ui/DashboardContent.tsx`
  - 行番号: 485, 505

### 2025-XX-XX
- 円グラフの食費の色を変更
  - `#ff6b6b` → `#e74c3c`
  - ファイル: `src/components/charts/PieChart.tsx`
  - 行番号: 32
```

---

このマニュアルを使って、自分好みの色にカスタマイズしてください！
