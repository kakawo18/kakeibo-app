import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Content Security Policy
 *
 * 現在は Report-Only（違反をブラウザのコンソールに報告するだけで、ブロックはしない）。
 * ログイン状態で一通り操作して違反が出ないことを確認したら、下の headers() で
 * ヘッダー名を 'Content-Security-Policy' に変えて強制モードにすること。
 *
 * - script-src に 'unsafe-inline' が必要: Next.js App Router がハイドレーション用の
 *   インラインスクリプトを埋め込むため。nonce 方式にすると全ページが動的レンダリングに
 *   なり静的プリレンダリングを失うので、現状はこの形にしている。
 * - style-src に 'unsafe-inline' が必要: Mantine がインラインスタイルを使うため。
 * - connect-src の googleapis.com は Firestore / Identity Toolkit / Installations 用。
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  // google.com / gstatic.com は App Check（reCAPTCHA）を有効にしたとき用
  `script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com${isDev ? " 'unsafe-eval'" : ''}`,
  "frame-src https://www.google.com",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com",
  "worker-src 'self'",
  "manifest-src 'self'",
].join('; ');

/** 全ページに付与するセキュリティヘッダー */
const securityHeaders = [
  // クリックジャッキング防止（CSP の frame-ancestors と二重にかける）
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // TODO: 動作確認後に 'Content-Security-Policy' へ変更して強制する
  { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy },
];

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

  // 本番ビルドでは console を除去する（家計データがコンソールに残らないようにする）。
  // 障害調査のため console.error だけは残す。
  compiler: {
    removeConsole: isDev ? false : { exclude: ['error'] },
  },

  // パフォーマンス最適化
  compress: true,
  poweredByHeader: false,

  // PWA設定 + セキュリティヘッダー
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
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
