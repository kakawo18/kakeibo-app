import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Vercelデプロイ最適化
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks', '@tabler/icons-react'],
  },
  
  // TypeScript設定
  typescript: {
    // ビルド時の型チェックを厳密に
    ignoreBuildErrors: false,
  },
  
  // ESLint設定
  eslint: {
    // ビルド時のESLintチェックを有効化
    ignoreDuringBuilds: false,
  },
  
  // PWA設定
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
