'use client';

import { useState, useEffect } from 'react';
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
import { RecurringTransaction } from '@/types';

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
        const transactions = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: user.uid,
            name: data.name,
            amount: data.amount,
            category: data.category,
            subcategory: data.subcategory,
            paymentMethod: data.paymentMethod,
            dayOfMonth: data.dayOfMonth,
            isEnabled: data.isEnabled,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as RecurringTransaction;
        });
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

  const addRecurringTransaction = async (
    data: Omit<RecurringTransaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) throw new Error('User not authenticated');

    const recurringTransactionsRef = collection(db, 'users', user.uid, 'recurringTransactions');
    const now = Timestamp.now();

    await addDoc(recurringTransactionsRef, {
      ...data,
      createdAt: now,
      updatedAt: now,
    });
  };

  const updateRecurringTransaction = async (
    id: string,
    data: Partial<Omit<RecurringTransaction, 'id' | 'userId' | 'createdAt'>>
  ) => {
    if (!user) throw new Error('User not authenticated');

    const recurringTransactionRef = doc(db, 'users', user.uid, 'recurringTransactions', id);
    await updateDoc(recurringTransactionRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  };

  const deleteRecurringTransaction = async (id: string) => {
    if (!user) throw new Error('User not authenticated');

    const recurringTransactionRef = doc(db, 'users', user.uid, 'recurringTransactions', id);
    await deleteDoc(recurringTransactionRef);
  };

  const getActiveRecurringTransactions = () => {
    return recurringTransactions.filter((transaction) => transaction.isEnabled);
  };

  const shouldShowRecurringTransaction = (transaction: RecurringTransaction) => {
    const today = new Date();
    const currentDay = today.getDate();
    return currentDay >= transaction.dayOfMonth;
  };

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
