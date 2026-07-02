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
];

export default eslintConfig;
