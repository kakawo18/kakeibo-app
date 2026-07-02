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
import { TransactionFormWrapper } from '@/components/TransactionFormWrapper';

const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
  fontFamily: 'var(--font-noto-sans-jp), var(--font-geist-sans), system-ui, sans-serif',
  headings: {
    fontFamily: 'var(--font-noto-sans-jp), var(--font-geist-sans), system-ui, sans-serif',
    fontWeight: '700',
  },
  components: {
    Paper: {
      defaultProps: {
        radius: 'lg',
      },
    },
    Card: {
      defaultProps: {
        radius: 'lg',
      },
    },
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
  colors: {
    dark: [
      '#f1f3f5', // 0: 最も明るい（テキスト用）
      '#e9ecef', // 1: 明るいテキスト
      '#909296', // 2: 薄いテキスト
      '#5c5f66', // 3: プレースホルダー
      '#373a40', // 4: ボーダー
      '#2c2e33', // 5: ホバー背景
      '#25262b', // 6: カード背景
      '#1f2023', // 7: 
      '#1a1b1e', // 8: ページ背景
      '#141517', // 9: 最も暗い
    ],
  },
  other: {
    // ダークモード時の追加設定
    darkCardBg: '#25262b',
    darkBorder: '#373a40',
    darkText: '#e9ecef',
    darkDimmed: '#909296',
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
  weight: ["400", "500", "700", "800"],
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
    apple: "/favicon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1976d2",
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
              <TransactionFormWrapper>
                {children}
              </TransactionFormWrapper>
            </AuthProvider>
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
