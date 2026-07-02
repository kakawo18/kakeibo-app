'use client';

import { Paper, Group, Text, UnstyledButton, rem } from '@mantine/core';
import { IconHome, IconPlus } from '@tabler/icons-react';
import { useTransactionForm } from '@/contexts/TransactionFormContext';

export const BottomNav = () => {
    const { openForm } = useTransactionForm();

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
                <UnstyledButton
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px 4px',
                        flex: 1,
                        color: 'var(--accent)',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <IconHome
                        style={{ width: rem(24), height: rem(24) }}
                        stroke={2}
                    />
                    <Text size="xs" mt={4} fw={600}>
                        ホーム
                    </Text>
                </UnstyledButton>

                <div style={{ position: 'relative', top: -20 }}>
                    <UnstyledButton
                        onClick={openForm}
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent)',
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
            </Group>
        </Paper>
    );
};

