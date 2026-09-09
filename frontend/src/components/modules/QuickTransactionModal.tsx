'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/axios';
import { TransactionType, CategoryType, Account, Category } from '@/types/finance';
import { formatLocalDateToInput, toSafeApiDateString } from '@/lib/date-utils';
import { useToast } from '@/components/ui/Toast';
import {
  X,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  PlusCircle,
  Wallet,
  Tag,
  Calendar,
  FileText,
} from 'lucide-react';

interface QuickTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialAccounts?: Account[];
}

export function QuickTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  initialAccounts,
}: QuickTransactionModalProps) {
  const toast = useToast();

  const [accounts, setAccounts] = useState<Account[]>(initialAccounts || []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);

  const [type, setType] = useState<TransactionType>(TransactionType.Expense);
  const [accountId, setAccountId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [subCategoryId, setSubCategoryId] = useState<number | ''>('');
  const [transactionDate, setTransactionDate] = useState(formatLocalDateToInput());
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Modal acildiginda hesap ve kategorileri yukle
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadMetadata = async () => {
      setIsLoadingMeta(true);
      try {
        const [accRes, catRes] = await Promise.allSettled([
          api.get<Account[]>('/api/accounts'),
          api.get<Category[]>('/api/categories'),
        ]);

        if (isMounted) {
          if (accRes.status === 'fulfilled') {
            setAccounts(accRes.value.data);
            if (accRes.value.data.length > 0 && !accountId) {
              setAccountId(accRes.value.data[0].id);
            }
          }
          if (catRes.status === 'fulfilled') {
            setCategories(catRes.value.data);
          }
        }
      } catch (e) {
        console.error('Failed to load transaction metadata', e);
      } finally {
        if (isMounted) setIsLoadingMeta(false);
      }
    };

    loadMetadata();

    // Reset Form
    setAmount('');
    setDescription('');
    setTransactionDate(formatLocalDateToInput());
    setCategoryId('');
    setSubCategoryId('');

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Secili ana kategorinin alt kategorileri
  const selectedParentCategory = useMemo(() => {
    return categories.find((c) => c.id === Number(categoryId));
  }, [categories, categoryId]);

  const availableSubCategories = selectedParentCategory?.subCategories || [];

  // ESC tusu ile kapatma
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !amount || Number(amount) <= 0) {
      toast.error('Lutfen gecerli bir hesap ve tutar giriniz.');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/api/transactions', {
        accountId: Number(accountId),
        amount: parseFloat(amount),
        type,
        transactionDate: toSafeApiDateString(transactionDate),
        categoryId: categoryId ? Number(categoryId) : null,
        subCategoryId: subCategoryId ? Number(subCategoryId) : null,
        description: description.trim() || undefined,
      });

      toast.success('Islem basariyla kaydedildi.', 'Hizli Islem');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save quick transaction', err);
      toast.error(err?.response?.data?.message || 'Islem kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Hizli Finansal Islem Ekle</h2>
              <p className="text-[11px] text-slate-400">Dashboard uzerinden aninda gelir veya gider kaydi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoadingMeta ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-xs">Hesaplar ve kategoriler yukleniyor...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* Gelir / Gider Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setType(TransactionType.Expense)}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  type === TransactionType.Expense
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>Gider</span>
              </button>
              <button
                type="button"
                onClick={() => setType(TransactionType.Income)}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  type === TransactionType.Income
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Gelir</span>
              </button>
            </div>

            {/* Tutar & Hesap */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Hesap *</span>
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(Number(e.target.value))}
                  required
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currentBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tutar (TL) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                  placeholder="0.00"
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                />
              </div>
            </div>

            {/* Ana Kategori & Alt Kategori */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Kategori</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value ? Number(e.target.value) : '');
                    setSubCategoryId('');
                  }}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Kategori Secin (Opsiyonel)</option>
                  {categories
                    .filter((c) =>
                      type === TransactionType.Expense
                        ? c.type !== CategoryType.Income
                        : c.type !== CategoryType.Expense
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Alt Kategori
                </label>
                <select
                  value={subCategoryId}
                  onChange={(e) => setSubCategoryId(e.target.value ? Number(e.target.value) : '')}
                  disabled={!availableSubCategories.length}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
                >
                  <option value="">Alt Kategori (Opsiyonel)</option>
                  {availableSubCategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tarih & Aciklama */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Tarih</span>
                </label>
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  required
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Aciklama</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Orn: Market alisverisi, Maas"
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
              >
                Vazgec
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Islemi Kaydet</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
