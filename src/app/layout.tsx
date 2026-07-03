import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';


import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { AuthProvider } from '@/contexts/AuthContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { TransactionsProvider } from '@/contexts/TransactionsContext';

const theme = createTheme({
  primaryColor: 'indigo',
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: 'md',
  fontFamily: 'var(--font-noto-sans-jp), var(--font-geist-sans), system-ui, sans-serif',
  headings: {
    fontFamily: 'var(--font-noto-sans-jp), var(--font-geist-sans), system-ui, sans-serif',
    fontWeight: '700',
  },
  components: {
    Paper: {
      defaultProps: {
        radius: 16,
      },
    },
    Card: {
      defaultProps: {
        radius: 16,
      },
    },
    Button: {
      defaultProps: {
        radius: 10,
      },
      styles: {
        label: { fontWeight: 600 },
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: 10,
      },
    },
    Modal: {
      defaultProps: {
        radius: 16,
        overlayProps: { backgroundOpacity: 0.45, blur: 4 },
      },
      styles: {
        title: { fontWeight: 700 },
      },
    },
    Badge: {
      styles: {
        label: { fontWeight: 600, textTransform: 'none' },
      },
    },
    // ポップオーバー系はヘアライン境界 + 浮遊影で統一
    Menu: {
      defaultProps: {
        radius: 12,
      },
      styles: {
        dropdown: {
          border: '1px solid var(--hairline)',
          boxShadow: 'var(--shadow-raised)',
          padding: 6,
        },
        item: {
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
        },
      },
    },
    Select: {
      styles: {
        dropdown: {
          border: '1px solid var(--hairline)',
          boxShadow: 'var(--shadow-raised)',
          borderRadius: 12,
          padding: 4,
        },
        option: {
          borderRadius: 8,
        },
      },
    },
    MultiSelect: {
      defaultProps: {
        radius: 10,
      },
      styles: {
        dropdown: {
          border: '1px solid var(--hairline)',
          boxShadow: 'var(--shadow-raised)',
          borderRadius: 12,
          padding: 4,
        },
        option: {
          borderRadius: 8,
        },
      },
    },
    Chip: {
      styles: {
        label: { fontWeight: 500 },
      },
    },
    SegmentedControl: {
      styles: {
        root: {
          background: 'var(--app-surface-2)',
          border: '1px solid var(--hairline)',
        },
        indicator: {
          background: 'var(--app-surface)',
          border: '1px solid var(--hairline)',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.10)',
        },
        label: { fontWeight: 600 },
      },
    },
    Tooltip: {
      defaultProps: {
        radius: 8,
      },
    },
  },
  // ダーク面をデザイントークン（--app-page / --app-surface）と揃える
  colors: {
    dark: [
      '#f2f3f5', // 0: 最も明るい（テキスト用）
      '#e9ecef', // 1: 明るいテキスト
      '#b8bcc4', // 2: 薄いテキスト
      '#82868f', // 3: プレースホルダー
      '#33353a', // 4: ボーダー
      '#232428', // 5: ホバー背景
      '#1d1e22', // 6: カード背景
      '#1a1b1e', // 7:
      '#131417', // 8: ページ背景
      '#0e0f11', // 9: 最も暗い
    ],
  },
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "家計簿アプリ",
  description: "シンプルで使いやすい家計簿管理アプリ",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "家計簿アプリ",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/favicon.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  // OSのステータスバー色をアプリの面色と揃える
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#131417" },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5, // ズーム可能にして入力時の問題を回避
  userScalable: true, // ユーザースケール可能にする
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansJP.variable} antialiased`}
      >
        <MantineProvider theme={theme} defaultColorScheme="auto">
          <ModalsProvider>
            <Notifications />
            <AuthProvider>
              <SettingsProvider>
                <TransactionsProvider>
                  {children}
                </TransactionsProvider>
              </SettingsProvider>
            </AuthProvider>
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
