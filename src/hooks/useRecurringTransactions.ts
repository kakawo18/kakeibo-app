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

  const addRecurringTransaction = useCallback(async (
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
  }, [user]);

  const updateRecurringTransaction = useCallback(async (
    id: string,
    data: Partial<Omit<RecurringTransaction, 'id' | 'userId' | 'createdAt'>>
  ) => {
    if (!user) throw new Error('User not authenticated');

    const recurringTransactionRef = doc(db, 'users', user.uid, 'recurringTransactions', id);
    await updateDoc(recurringTransactionRef, {
      ...data,
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

  const shouldShowRecurringTransaction = useCallback((
    recurring: RecurringTransaction,
    existingTransactions: Transaction[] = []
  ) => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // 1. 日付チェック: 設定日を過ぎているか
    // dayOfMonth が月の日数を超える場合（例: 31日設定の2月）は月末日を実効日とする
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const effectiveDay = Math.min(recurring.dayOfMonth, daysInCurrentMonth);
    if (currentDay < effectiveDay) {
      return false;
    }

    // 2. 済みチェック: 今月すでに登録済みか
    // (金額、カテゴリ、サブカテゴリ、そして説明文(名前)が一致する取引が今月に存在するか確認)
    const alreadyRecorded = existingTransactions.some((t) => {
      const tDate = new Date(t.date);
      const isSameMonth =
        tDate.getFullYear() === currentYear &&
        tDate.getMonth() === currentMonth;

      if (!isSameMonth) return false;

      // カテゴリ・金額の一致
      const isBasicMatch =
        t.category === recurring.category &&
        t.amount === recurring.amount &&
        (recurring.subcategory ? t.subcategory === recurring.subcategory : true);

      if (!isBasicMatch) return false;

      // 名前（description）による厳密なチェック
      // 登録時に description に recurring.name が入るようになったため、
      // これが一致すれば「この定期取引から生成された」とみなせる。
      // ※古いデータなどはdescriptionがないかもしれないので、その場合はBasicMatchだけで判定せざるを得ないが、
      // 今回の修正で「同じ金額の別定期取引」が消えるのを防ぐにはこれが必須。
      if (recurring.name && t.description) {
        return t.description.includes(recurring.name);
      }

      // descriptionがない場合は、BasicMatchだけで緩く判定（従来通り）
      return true;
    });

    return !alreadyRecorded;
  }, []);

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
