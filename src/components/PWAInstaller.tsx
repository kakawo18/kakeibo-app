'use client';

import { useEffect, useState } from 'react';
import { Button, Modal, Text, Stack, Group } from '@mantine/core';
import { IconDownload, IconX } from '@tabler/icons-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstaller = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // ブラウザ環境でのみ実行
    if (typeof window === 'undefined') return;
    
    // Service Worker登録（本番のみ。開発中はキャッシュがHMR・動作確認を妨げるため、
    // 逆に登録済みのSWがあれば解除して古いキャッシュの影響を排除する）
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('SW registered: ', registration);
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
          });
      } else {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        });
      }
    }

    // PWAインストールプロンプトの処理
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    // アプリがインストール済みかチェック
    const checkIfInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
    });

    checkIfInstalled();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // 24時間後に再表示
    if (typeof window !== 'undefined') {
      localStorage.setItem('pwa-dismissed', Date.now().toString());
    }
  };

  // インストール済みまたは24時間以内に却下された場合は表示しない
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const dismissed = localStorage.getItem('pwa-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const now = Date.now();
      const hoursPassed = (now - dismissedTime) / (1000 * 60 * 60);
      
      if (hoursPassed < 24) {
        setShowInstallPrompt(false);
      }
    }
  }, []);

  if (isInstalled || !showInstallPrompt) {
    return null;
  }

  return (
    <Modal
      opened={showInstallPrompt}
      onClose={handleDismiss}
      title="アプリをインストール"
      centered
      size="sm"
    >
      <Stack gap="md">
        <Text size="sm">
          家計簿アプリをホーム画面に追加して、より快適にご利用いただけます。
        </Text>
        
        <Stack gap="xs">
          <Text size="xs" c="dimmed">📱 ホーム画面からワンタップで起動</Text>
          <Text size="xs" c="dimmed">⚡ 高速な動作</Text>
          <Text size="xs" c="dimmed">📴 オフラインでも基本機能が利用可能</Text>
          <Text size="xs" c="dimmed">🔔 プッシュ通知対応</Text>
        </Stack>

        <Group justify="flex-end" gap="xs">
          <Button
            variant="light"
            color="gray"
            onClick={handleDismiss}
            leftSection={<IconX size={16} />}
          >
            後で
          </Button>
          <Button
            onClick={handleInstallClick}
            leftSection={<IconDownload size={16} />}
          >
            インストール
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};