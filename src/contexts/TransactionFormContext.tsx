'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface TransactionFormContextType {
    isFormOpen: boolean;
    openForm: () => void;
    closeForm: () => void;
}

const TransactionFormContext = createContext<TransactionFormContextType | null>(null);

export const TransactionFormProvider = ({ children }: { children: ReactNode }) => {
    const [isFormOpen, setIsFormOpen] = useState(false);

    const openForm = useCallback(() => setIsFormOpen(true), []);
    const closeForm = useCallback(() => setIsFormOpen(false), []);

    return (
        <TransactionFormContext.Provider value={{ isFormOpen, openForm, closeForm }}>
            {children}
        </TransactionFormContext.Provider>
    );
};

export const useTransactionForm = () => {
    const context = useContext(TransactionFormContext);
    if (!context) {
        throw new Error('useTransactionForm must be used within TransactionFormProvider');
    }
    return context;
};
