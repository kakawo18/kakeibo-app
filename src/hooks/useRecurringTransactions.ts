'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { RecurringTransaction, Transaction } from '@/types';
import { shouldShowRecurring } from '@/utils/recurring';
import {
  RecurringTransactionInput,
  fromRecurringDoc,
  toRecurringCreateData,
  toRecurringUpdateData,
} from '@/data/recurringTransactionSerializer';

export const useRecurringTransactions = () => {
  const { user } = useAuth();
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRecurringTransactions([]);
      setLoading(false);
      return;
    }

    const recurringTransactionsRef = collection(db, 'users', user.uid, 'recurringTransactions');
    const q = query(recurringTransactionsRef, orderBy('dayOfMonth', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const transactions = snapshot.docs.map((docSnapshot) =>
          fromRecurringDoc(docSnapshot.id, user.uid, docSnapshot.data())
        );
        setRecurringTransactions(transactions);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching recurring transactions:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const addRecurringTransaction = useCallback(async (data: RecurringTransactionInput) => {
    if (!user) throw new Error('User not authenticated');

    const recurringTransactionsRef = collection(db, 'users', user.uid, 'recurringTransactions');
    const now = Timestamp.now();

    await addDoc(recurringTransactionsRef, {
      ...toRecurringCreateData(data),
      createdAt: now,
      updatedAt: now,
    });
  }, [user]);

  const updateRecurringTransaction = useCallback(async (
    id: string,
    data: Partial<RecurringTransactionInput>
  ) => {
    if (!user) throw new Error('User not authenticated');

    // 省略した項目は変更しない。サブカテゴリ・支払方法の空文字は項目の削除（#98）
    const recurringTransactionRef = doc(db, 'users', user.uid, 'recurringTransactions', id);
    await updateDoc(recurringTransactionRef, {
      ...toRecurringUpdateData(data),
      updatedAt: Timestamp.now(),
    });
  }, [user]);

  const deleteRecurringTransaction = useCallback(async (id: string) => {
    if (!user) throw new Error('User not authenticated');

    const recurringTransactionRef = doc(db, 'users', user.uid, 'recurringTransactions', id);
    await deleteDoc(recurringTransactionRef);
  }, [user]);

  // 参照が安定するよう useCallback で包む（利用側の useMemo が毎レンダー無効化されるのを防ぐ）
  const getActiveRecurringTransactions = useCallback(() => {
    return recurringTransactions.filter((transaction) => transaction.isEnabled);
  }, [recurringTransactions]);

  // 判定の中身は utils/recurring.ts（定期取引 ID と対象月で記録済みを判定する。#101）
  const shouldShowRecurringTransaction = useCallback(
    (recurring: RecurringTransaction, existingTransactions: Transaction[] = []) =>
      shouldShowRecurring(recurring, existingTransactions),
    []
  );

  return {
    recurringTransactions,
    loading,
    addRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    getActiveRecurringTransactions,
    shouldShowRecurringTransaction,
  };
};
