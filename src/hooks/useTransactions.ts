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

// Firestore用のクリーンなトランザクションデータの型定義
interface CleanTransactionData {
  type?: 'income' | 'expense';
  amount?: number;
  category?: string;
  date?: Timestamp;
  transactionType?: 'normal' | 'card_payment' | 'card_withdrawal';
  affectsExpense?: boolean;
  affectsBalance?: boolean;
  subcategory?: string;
  paymentMethod?: string;
  description?: string;
}

// トランザクションデータをFirestore用にクリーニングするヘルパー関数
const cleanTransactionData = (transaction: Partial<Transaction>): CleanTransactionData => {
  const cleaned: CleanTransactionData = {};

  // 基本フィールドの処理
  if (transaction.type !== undefined) {
    cleaned.type = transaction.type;
  }
  if (transaction.amount !== undefined) {
    cleaned.amount = transaction.amount;
  }
  if (transaction.category !== undefined) {
    cleaned.category = transaction.category;
  }
  if (transaction.date !== undefined) {
    cleaned.date = Timestamp.fromDate(transaction.date instanceof Date ? transaction.date : new Date(transaction.date));
  }
  if (transaction.transactionType !== undefined) {
    cleaned.transactionType = transaction.transactionType;
  }
  if (transaction.affectsExpense !== undefined) {
    cleaned.affectsExpense = transaction.affectsExpense;
  }
  if (transaction.affectsBalance !== undefined) {
    cleaned.affectsBalance = transaction.affectsBalance;
  }

  // オプショナルフィールドの処理
  // subcategory と paymentMethod: 値がある場合のみ追加、空文字列は除外
  if (transaction.subcategory && transaction.subcategory.trim()) {
    cleaned.subcategory = transaction.subcategory.trim();
  }
  if (transaction.paymentMethod && transaction.paymentMethod.trim()) {
    cleaned.paymentMethod = transaction.paymentMethod.trim();
  }
  
  // description: 空文字列削除に対応するため、undefinedでない場合は常に設定
  if (transaction.description !== undefined) {
    cleaned.description = transaction.description.trim() || '';
  }

  return cleaned;
};

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

    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const transactionList: Transaction[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          try {
            // データの型安全性を確保（金額0の取引は有効なので == null で判定）
            if (!data.type || data.amount == null || !data.category || !data.date) {
              console.warn('Incomplete transaction data:', doc.id, data);
              return;
            }

            transactionList.push({
              id: doc.id,
              userId: data.userId,
              type: data.type,
              amount: Number(data.amount),
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
      },
      (error) => {
        console.error('Error listening to transactions:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;

    const now = new Date();
    
    // 共通ヘルパー関数を使用してデータをクリーニング
    const cleanedData = cleanTransactionData({
      ...transaction,
      transactionType: transaction.transactionType || 'normal',
      affectsExpense: transaction.affectsExpense !== undefined ? transaction.affectsExpense : true,
      affectsBalance: transaction.affectsBalance !== undefined ? transaction.affectsBalance : true,
    });

    // 新規作成用の追加フィールド
    const transactionData = {
      ...cleanedData,
      userId: user.uid,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    };

    try {
      await addDoc(collection(db, 'transactions'), transactionData);
    } catch (error) {
      console.error('Error adding transaction:', error);
      throw error;
    }
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (!user) return;

    const docRef = doc(db, 'transactions', id);
    
    // 共通ヘルパー関数を使用してデータをクリーニング
    const cleanedData = cleanTransactionData(updates);
    
    // 更新用の追加フィールド
    const updateData = {
      ...cleanedData,
      updatedAt: Timestamp.fromDate(new Date()),
    };

    try {
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!user) return;
    
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  };

  return {
    transactions,
    loading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  };
};