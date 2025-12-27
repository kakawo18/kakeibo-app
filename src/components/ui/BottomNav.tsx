'use client';

import { Paper, Group, Text, UnstyledButton, rem } from '@mantine/core';
import { IconHome, IconChartBar, IconPlus, IconSettings, IconCalendar } from '@tabler/icons-react';
import { useRouter, usePathname } from 'next/navigation';

export const BottomNav = () => {
    const router = useRouter();
    const pathname = usePathname();

    const links = [
        { icon: IconHome, label: 'ホーム', href: '/' },
        { icon: IconCalendar, label: 'カレンダー', href: '/calendar' },
        { icon: IconChartBar, label: '分析', href: '/analysis' },
        { icon: IconSettings, label: '設定', href: '/settings' },
    ];

    const mainLinks = links.map((link) => {
        const isActive = pathname === link.href;
        return (
            <UnstyledButton
                key={link.label}
                onClick={() => router.push(link.href)}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 4px',
                    flex: 1,
                    color: isActive ? 'var(--mantine-color-blue-filled)' : 'var(--mantine-color-dimmed)',
                    transition: 'all 0.2s ease',
                }}
            >
                <link.icon
                    style={{ width: rem(24), height: rem(24) }}
                    stroke={isActive ? 2 : 1.5}
                />
                <Text size="xs" mt={4} fw={isActive ? 600 : 400}>
                    {link.label}
                </Text>
            </UnstyledButton>
        );
    });

    return (
        <Paper
            shadow="md"
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 100,
                borderTop: '1px solid var(--mantine-color-default-border)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                backgroundColor: 'var(--mantine-color-body)',
            }}
            hiddenFrom="sm"
        >
            <Group justify="space-around" gap={0} h={60} px="xs">
                {mainLinks.slice(0, 2)}

                <div style={{ position: 'relative', top: -20 }}>
                    <UnstyledButton
                        onClick={() => {
                            // TODO: Implement Add Transaction Modal trigger
                            const event = new CustomEvent('open-transaction-modal');
                            window.dispatchEvent(event);
                        }}
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            backgroundColor: 'var(--mantine-color-blue-filled)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                        }}
                    >
                        <IconPlus style={{ width: rem(32), height: rem(32) }} stroke={2} />
                    </UnstyledButton>
                </div>

                {mainLinks.slice(2)}
            </Group>
        </Paper>
    );
};
