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
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { TransactionTemplate } from '@/types';

export const useTransactionTemplates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TransactionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'transactionTemplates'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const templatesData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            lastUsed: data.lastUsed?.toDate() || new Date(),
          } as TransactionTemplate;
        });
        
        // クライアント側でソート（usageCount降順、lastUsed降順）
        const sortedTemplates = templatesData.sort((a, b) => {
          if (a.usageCount !== b.usageCount) {
            return b.usageCount - a.usageCount;
          }
          return b.lastUsed.getTime() - a.lastUsed.getTime();
        });
        
        setTemplates(sortedTemplates);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Error fetching templates:', error);
        setError('テンプレートの取得に失敗しました');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const addTemplate = async (templateData: Omit<TransactionTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'lastUsed' | 'usageCount'>) => {
    if (!user) throw new Error('ユーザーがログインしていません');

    const template = {
      ...templateData,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastUsed: serverTimestamp(),
      usageCount: 0,
    };

    await addDoc(collection(db, 'transactionTemplates'), template);
  };

  const updateTemplate = async (id: string, updates: Partial<TransactionTemplate>) => {
    if (!user) throw new Error('ユーザーがログインしていません');

    const templateRef = doc(db, 'transactionTemplates', id);
    await updateDoc(templateRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteTemplate = async (id: string) => {
    if (!user) throw new Error('ユーザーがログインしていません');

    const templateRef = doc(db, 'transactionTemplates', id);
    await deleteDoc(templateRef);
  };

  const useTemplate = async (id: string) => {
    if (!user) throw new Error('ユーザーがログインしていません');

    const template = templates.find(t => t.id === id);
    if (!template) throw new Error('テンプレートが見つかりません');

    const templateRef = doc(db, 'transactionTemplates', id);
    await updateDoc(templateRef, {
      lastUsed: serverTimestamp(),
      usageCount: template.usageCount + 1,
    });

    return template;
  };

  const getPopularTemplates = (limit = 3) => {
    return templates
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  };

  const getRecentTemplates = (limit = 3) => {
    return templates
      .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
      .slice(0, limit);
  };

  return {
    templates,
    loading,
    error,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    useTemplate,
    getPopularTemplates,
    getRecentTemplates,
  };
};