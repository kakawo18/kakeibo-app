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
              group: ["@/components/*", "@/contexts/*", "@/data/*", "@/lib/*", "@/app/*", "@/hooks/*"],
              message: "src/domain から画面・Context・データアクセスを参照しない（docs/architecture.md の依存方向）",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
