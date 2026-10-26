import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "next-env.d.ts",
      "public/sw.js",
      // Playwright の結果（トレースに含まれる画面のスクリプトなど）
      "test-results/**",
      "playwright-report/**",
      "blob-report/**",
    ],
  },
  {
    // Playwright のフィクスチャは use() で値を渡すが、React のフックではない
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    rules: {
      // Firestoreのonsnapshot購読ではログアウト時にeffect内で状態をクリアする必要がある
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // 会計の計算（src/domain）は画面・保存方法から独立させる（#123）。
    // 依存してよいのは @/types・@/utils（日付などの汎用処理）・domain の中だけ
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "next", "next/*", "firebase", "firebase/*", "@firebase/*", "firebase-admin", "firebase-admin/*", "@mantine/*"],
              message: "src/domain は React・Next・Firebase・Mantine に依存しない（docs/architecture.md の依存方向）",
            },
            {
              group: ["@/components/*", "@/contexts/*", "@/data/*", "@/lib/*", "@/app/*", "@/hooks/*", "@/features", "@/features/*", "@/server", "@/server/*"],
              message: "src/domain から画面・Context・データアクセスを参照しない（docs/architecture.md の依存方向）",
            },
          ],
        },
      ],
    },
  },
  {
    // 機能（src/features/*）の中のファイルは、機能の外から直接参照しない（#124）。
    // 外からは各機能の index.ts（公開窓口）だけを使い、機能の中では相対パスで参照する
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ["src/domain/**", "src/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/*"],
              message: "機能の中のファイルを直接参照しない。@/features/<機能名>（index.ts）から import する",
            },
          ],
        },
      ],
    },
  },
  {
    // サーバー専用のコード（src/server）と Admin SDK は、画面・Context・データアクセスから使わない。
    // Admin SDK は firestore.rules を通らないので、使う場所を src/server に限る
    // （docs/claude-connector/仕様書.md 7.1）。上の機能の公開窓口の規則もここで重ねてかける
    files: ["src/features/**/*.{ts,tsx}", "src/contexts/**/*.{ts,tsx}", "src/data/**/*.ts", "src/hooks/**/*.ts", "src/lib/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/*"],
              message: "機能の中のファイルを直接参照しない。@/features/<機能名>（index.ts）から import する",
            },
            {
              group: ["@/server", "@/server/*", "firebase-admin", "firebase-admin/*"],
              message: "src/server と Admin SDK はサーバー専用。画面・Context・データアクセスから使わない（docs/claude-connector/仕様書.md 7.1）",
            },
          ],
        },
      ],
    },
  },
  {
    // firebase-admin/auth は使わない。依存する jwks-rsa が ES モジュールの jose を require() し、
    // Vercel の Node.js 22（require(esm) に未対応の版）では読み込みに失敗して 500 になる（v6.7.2）。
    // Firebase の ID トークンは src/server/oauth/firebaseIdToken.ts が jose で検証する
    files: ["src/server/**/*.ts", "src/app/**/*.ts", "src/app/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "firebase-admin/auth",
              message: "firebase-admin/auth は Vercel で読み込めない。ID トークンは src/server/oauth/firebaseIdToken.ts で検証する",
            },
            {
              name: "firebase-admin",
              message: "firebase-admin（auth も読み込む）は使わない。firebase-admin/app・firebase-admin/firestore を個別に読み込む",
            },
          ],
          // 同じファイルにかかる上の規則（機能の公開窓口）はこのブロックで置き換わるので、ここでも重ねてかける
          patterns: [
            {
              group: ["@/features/*/*"],
              message: "機能の中のファイルを直接参照しない。@/features/<機能名>（index.ts）から import する",
            },
          ],
        },
      ],
    },
  },
  {
    // 共通 UI（src/components）は特定の機能に依存しない（#124）
    files: ["src/components/**/*.ts", "src/components/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features", "@/features/*"],
              message: "src/components は共通 UI。特定の機能（src/features）に依存しない",
            },
            {
              group: ["@/server", "@/server/*", "firebase-admin", "firebase-admin/*"],
              message: "src/server と Admin SDK はサーバー専用。共通 UI から使わない（docs/claude-connector/仕様書.md 7.1）",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
