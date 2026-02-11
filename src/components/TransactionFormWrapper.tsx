'use client';

import { TransactionFormProvider } from '@/contexts/TransactionFormContext';

export const TransactionFormWrapper = ({ children }: { children: React.ReactNode }) => {
    return (
        <TransactionFormProvider>
            {children}
        </TransactionFormProvider>
    );
};
