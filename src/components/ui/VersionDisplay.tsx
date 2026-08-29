'use client';

import { Text, Group, Badge, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import packageJson from '../../../package.json';

/** 開発元 */
const COMPANY_NAME = 'Gorillaburg Inc.';

/**
 * デプロイされているコミットのSHA（先頭7桁）
 *
 * Vercel が自動で渡すシステム環境変数を使う。
 * 「今ブラウザで見ているものが、どのコミットのビルドなのか」を画面から判別するためのもの。
 * デプロイしたつもりが古いビルドのままだった、という切り分けに使う。
 *
 * ローカルの `npm run dev` / `npm run build` では未定義なので何も表示しない。
 * 本番で表示されない場合は、Vercel のプロジェクト設定で
 * 「Automatically expose System Environment Variables」が無効になっている
 * （詳細は docs/deployment.md）。
 *
 * ※ next.config.ts の `env` は使わない（AGENTS.md）。NEXT_PUBLIC_ 付きの
 *   環境変数だけがクライアントに露出してよい。コミットSHAは公開リポジトリの
 *   情報なので秘密ではない。
 */
const COMMIT_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? '';
const SHORT_SHA = COMMIT_SHA.slice(0, 7);

export const VersionDisplay: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <Stack gap={4} align="center" py={isMobile ? 8 : 12}>
      <Group gap="xs">
        <Text size={isMobile ? 'xs' : 'sm'} c="dimmed">
          家計簿アプリ
        </Text>
        <Badge size={isMobile ? 'xs' : 'sm'} variant="light" color="blue">
          v{packageJson.version}
        </Badge>
        {SHORT_SHA && (
          <Badge
            size={isMobile ? 'xs' : 'sm'}
            variant="default"
            className="tabular-nums"
            title={`デプロイ中のコミット: ${COMMIT_SHA}`}
          >
            {SHORT_SHA}
          </Badge>
        )}
      </Group>
      <Text size="xs" c="dimmed">
        © {COMPANY_NAME}
      </Text>
    </Stack>
  );
};
