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
    ],
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
              group: ["react", "react-dom", "next", "next/*", "firebase", "firebase/*", "@firebase/*", "@mantine/*"],
              message: "src/domain は React・Next・Firebase・Mantine に依存しない（docs/architecture.md の依存方向）",
            },
            {
              group: ["@/components/*", "@/contexts/*", "@/data/*", "@/lib/*", "@/app/*", "@/hooks/*", "@/features", "@/features/*"],
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
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
