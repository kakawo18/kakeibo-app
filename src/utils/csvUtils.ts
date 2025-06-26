import { Transaction } from '@/types';
import { formatDate } from './dateUtils';

export const exportToCSV = (transactions: Transaction[]): void => {
  const headers = ['日付', '種別', 'カテゴリ', 'サブカテゴリ', '金額', 'メモ'];
  
  const csvContent = [
    headers.join(','),
    ...transactions.map(transaction => [
      formatDate(transaction.date),
      transaction.type === 'income' ? '収入' : '支出',
      transaction.category,
      transaction.subcategory || '',
      transaction.amount,
      transaction.description || '',
    ].map(field => `"${field}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `家計簿_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const parseCSV = (csvText: string): Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] => {
  const lines = csvText.split('\n').filter(line => line.trim());
  
  // Skip header row
  const dataLines = lines.slice(1);
  
  return dataLines.map(line => {
    const fields = line.split(',').map(field => field.replace(/^"|"$/g, ''));
    
    return {
      date: new Date(fields[0]),
      type: fields[1] === '収入' ? 'income' as const : 'expense' as const,
      category: fields[2],
      subcategory: fields[3] || undefined,
      amount: parseInt(fields[4]),
      description: fields[5] || undefined,
    };
  }).filter(transaction => 
    !isNaN(transaction.date.getTime()) && 
    !isNaN(transaction.amount) &&
    transaction.category
  );
};