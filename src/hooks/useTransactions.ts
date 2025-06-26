'use client';

import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Transaction } from '@/types';

export const useTransactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactionList: Transaction[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        try {
          transactionList.push({
            id: doc.id,
            userId: data.userId,
            type: data.type,
            amount: data.amount,
            category: data.category,
            subcategory: data.subcategory || undefined,
            paymentMethod: data.paymentMethod || undefined,
            transactionType: data.transactionType || 'normal',
            affectsExpense: data.affectsExpense !== undefined ? data.affectsExpense : true,
            affectsBalance: data.affectsBalance !== undefined ? data.affectsBalance : true,
            date: data.date?.toDate() || new Date(),
            description: data.description || undefined,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as Transaction);
        } catch (error) {
          console.error('Error processing transaction data:', error, data);
        }
      });
      setTransactions(transactionList);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;

    const now = new Date();
    
    // undefinedフィールドを除外
    const cleanedTransaction: {
      type: 'income' | 'expense';
      amount: number;
      category: string;
      date: Timestamp;
      transactionType: 'normal' | 'card_payment' | 'card_withdrawal';
      affectsExpense: boolean;
      affectsBalance: boolean;
      userId: string;
      createdAt: Timestamp;
      updatedAt: Timestamp;
      subcategory?: string;
      paymentMethod?: string;
      description?: string;
    } = {
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      date: Timestamp.fromDate(transaction.date instanceof Date ? transaction.date : new Date(transaction.date)),
      transactionType: transaction.transactionType || 'normal',
      affectsExpense: transaction.affectsExpense !== undefined ? transaction.affectsExpense : true,
      affectsBalance: transaction.affectsBalance !== undefined ? transaction.affectsBalance : true,
      userId: user.uid,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    };

    // subcategory、paymentMethod、descriptionは値がある場合のみ追加
    if (transaction.subcategory) {
      cleanedTransaction.subcategory = transaction.subcategory;
    }
    if (transaction.paymentMethod) {
      cleanedTransaction.paymentMethod = transaction.paymentMethod;
    }
    if (transaction.description) {
      cleanedTransaction.description = transaction.description;
    }

    await addDoc(collection(db, 'transactions'), cleanedTransaction);
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    const docRef = doc(db, 'transactions', id);
    const updateData = { ...updates };
    
    if (updates.date) {
      (updateData as Record<string, unknown>).date = Timestamp.fromDate(updates.date instanceof Date ? updates.date : new Date(updates.date));
    }
    (updateData as Record<string, unknown>).updatedAt = Timestamp.fromDate(new Date());

    await updateDoc(docRef, updateData);
  };

  const deleteTransaction = async (id: string) => {
    await deleteDoc(doc(db, 'transactions', id));
  };

  return {
    transactions,
    loading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  };
};