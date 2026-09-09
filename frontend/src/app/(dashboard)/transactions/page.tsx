'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/axios';
import { Transaction, Account, Category, TransactionType, CategoryType } from '@/types/finance';
import { useAuthStore } from '@/store/auth-store';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatLocalDateToInput, toSafeApiDateString } from '@/lib/date-utils';
import { matchesSearch } from '@/lib/search-utils';
import {
  ArrowUpDown,
  Plus,
  Trash2,
  Edit2,
  Pencil,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Check,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ArrowRightLeft,
} from 'lucide-react';

export default function TransactionsPage() {
  const isValuesHidden = useAuthStore((state) => state.isValuesHidden);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Modal State (Create & Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [subCategoryId, setSubCategoryId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>(TransactionType.Expense);
  const [transactionDate, setTransactionDate] = useState(formatLocalDateToInput());
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Confirm Modal State
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [transRes, accRes, catRes] = await Promise.all([
        api.get<Transaction[]>('/api/transactions'),
        api.get<Account[]>('/api/accounts'),
        api.get<Category[]>('/api/categories'),
      ]);
      setTransactions(transRes.data);
      setAccounts(accRes.data);
      setCategories(catRes.data);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setAccountId(accounts[0]?.id || '');
    setCategoryId('');
    setSubCategoryId('');
    setAmount('');
    setType(TransactionType.Expense);
    setTransactionDate(formatLocalDateToInput());
    setDescription('');
    setTags('');
    setIsModalOpen(true);
  };

  const openEditModal = (t: Transaction) => {
    setEditingId(t.id);
    setAccountId(t.accountId);
    setCategoryId(t.categoryId || '');
    setSubCategoryId(t.subCategoryId || '');
    setAmount(t.amount.toString());
    setType(t.type);
    setTransactionDate(formatLocalDateToInput(t.transactionDate));
    setDescription(t.description || '');
    setTags(t.tags || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return;
    setIsSaving(true);

    try {
      if (editingId) {
        // Update Transaction
        await api.put(`/api/transactions/${editingId}`, {
          id: editingId,
          accountId: Number(accountId),
          categoryId: categoryId ? Number(categoryId) : null,
          subCategoryId: subCategoryId ? Number(subCategoryId) : null,
          amount: parseFloat(amount) || 0,
          type,
          transactionDate: toSafeApiDateString(transactionDate),
          description,
          tags,
        });
      } else {
        // Create Transaction
        await api.post('/api/transactions', {
          accountId: Number(accountId),
          categoryId: categoryId ? Number(categoryId) : null,
          subCategoryId: subCategoryId ? Number(subCategoryId) : null,
          amount: parseFloat(amount) || 0,
          type,
          transactionDate: toSafeApiDateString(transactionDate),
          description,
          tags,
        });
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save transaction', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (t: Transaction) => {
    setConfirmModalState({
      isOpen: true,
      title: t.isTransfer ? 'Transfer Kaydını Sil' : 'İşlemi Sil',
      message: `"${t.description || 'Bu işlem'}" kaydını silmek istediğinize emin misiniz? Hesap bakiyeleri önceki haline getirilecektir.`,
      onConfirm: async () => {
        try {
          if (t.isTransfer && t.transferId) {
            await api.delete(`/api/transfers/${t.transferId}`);
          } else {
            await api.delete(`/api/transactions/${t.id}`);
          }
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          fetchData();
        } catch (err) {
          console.error(err);
        }
      },
    });
  };

  // Selected Category's Subcategories
  const selectedParentCategory = categories.find((c) => c.id === Number(categoryId));
  const availableSubCategories = selectedParentCategory?.subCategories || [];

  // Filtered transactions
  const filteredData = useMemo(() => {
    return transactions.filter((t) => {
      if (selectedAccount && t.accountId !== Number(selectedAccount)) return false;
      if (selectedCategory && t.categoryId !== Number(selectedCategory) && t.subCategoryId !== Number(selectedCategory))
        return false;
      if (selectedType && t.type !== Number(selectedType)) return false;
      if (searchTerm) {
        const isMatch = matchesSearch([t.description], searchTerm);
        if (!isMatch) return false;
      }
      return true;
    });
  }, [transactions, selectedAccount, selectedCategory, selectedType, searchTerm]);

  // Her bir işlem için o anki (İşlem Öncesi ve İşlem Sonrası) hesap bakiyesini hatasız hesaplayalım
  const transactionBalanceMap = useMemo(() => {
    // 1. Hesapların güncel bakiyelerini alalım
    const accountBalanceMap = new Map<number, number>();
    for (const acc of accounts) {
      accountBalanceMap.set(acc.id, acc.currentBalance ?? acc.initialBalance ?? 0);
    }

    // 2. Tüm işlemleri hesap bazında gruplayalım
    const accountTransactions = new Map<number, Transaction[]>();
    for (const t of transactions) {
      const list = accountTransactions.get(t.accountId) || [];
      list.push(t);
      accountTransactions.set(t.accountId, list);
    }

    const resultMap = new Map<number, { before: number; after: number }>();

    // 3. Her hesap için geriye doğru bakiye simülasyonu yapalım
    for (const [accId, txList] of accountTransactions.entries()) {
      // En yeniden en eskiye sırala (Tarih azalan, ID azalan)
      const sorted = [...txList].sort((a, b) => {
        const timeA = new Date(a.transactionDate).getTime();
        const timeB = new Date(b.transactionDate).getTime();
        if (timeA !== timeB) return timeB - timeA;
        return b.id - a.id;
      });

      let currentRunningAfter = accountBalanceMap.get(accId) ?? 0;

      for (const t of sorted) {
        const isIncome = t.type === TransactionType.Income;
        const amt = t.amount;

        // İşlem öncesi bakiye
        const before = isIncome ? currentRunningAfter - amt : currentRunningAfter + amt;
        const after = currentRunningAfter;

        resultMap.set(t.id, { before, after });

        // Bir önceki (daha eski) işlem için sonraki bakiye = bu işlemin öncesi bakiye
        currentRunningAfter = before;
      }
    }

    return resultMap;
  }, [transactions, accounts]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage]);

  return (
    <div>
      <Header
        title="Finansal İşlemler (Ledger)"
        description="Tüm gelir ve gider hareketlerinizin detaylı dökümü, düzenleme ve filtreleri"
        actions={
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni İşlem Ekle</span>
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 mb-6 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Açıklama ara..."
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Account Filter */}
          <select
            value={selectedAccount}
            onChange={(e) => {
              setSelectedAccount(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tüm Hesaplar</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tüm Kategoriler</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Gelir & Gider</option>
            <option value={TransactionType.Income}>Sadece Gelirler</option>
            <option value={TransactionType.Expense}>Sadece Giderler</option>
          </select>

          {/* Clear Filters (X) */}
          {(selectedAccount || selectedCategory || selectedType || searchTerm) && (
            <button
              onClick={() => {
                setSelectedAccount('');
                setSelectedCategory('');
                setSelectedType('');
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-2.5 py-1.5 rounded-xl transition cursor-pointer font-medium"
              title="Filtreleri Temizle"
            >
              <X className="w-3.5 h-3.5" />
              <span>Filtreleri Sıfırla</span>
            </button>
          )}

          {/* Refresh Data */}
          <button
            onClick={fetchData}
            className="p-2 text-slate-400 hover:text-white bg-slate-950/60 hover:bg-slate-800 border border-slate-800 rounded-xl transition cursor-pointer"
            title="Listeyi Yenile"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Toplam {filteredData.length} işlem listelendi
        </span>
      </div>

      {/* Transactions Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Tarih</th>
                  <th className="py-2.5 px-3">Açıklama</th>
                  <th className="py-2.5 px-3">Hesap</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3 text-right">Tutar</th>
                  <th className="py-2.5 px-3 text-center w-20">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {paginatedData.length > 0 ? (
                  paginatedData.map((t) => {
                    const isIncome = t.type === TransactionType.Income;
                    const date = new Date(t.transactionDate);

                    return (
                      <tr key={t.id} className={`hover:bg-slate-800/40 transition group ${t.isTransfer ? 'bg-cyan-950/10' : ''}`}>
                        <td className="py-2 px-3 text-slate-400 font-mono whitespace-nowrap">
                          {date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            {t.isTransfer && (
                              <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            )}
                            <span className="text-white font-medium">{t.description || 'Açıklama yok'}</span>
                          </div>
                          {t.tags && (
                            <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded ml-1.5 inline-block">
                              #{t.tags}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="text-[11px] text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md">
                            {t.accountName}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {t.isTransfer ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>{t.categoryName || 'Transfer'}</span>
                            </span>
                          ) : (
                            <>
                              <span className="text-slate-300 font-medium">{t.categoryName || 'Kategorisiz'}</span>
                              {t.subCategoryName && <span className="text-[11px] text-slate-500 ml-1">› {t.subCategoryName}</span>}
                            </>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          {/* Ana Tutar */}
                          <div className={`font-bold font-mono text-xs flex items-center justify-end gap-1 ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isValuesHidden ? (
                              '*** ₺'
                            ) : (
                              <>
                                {isIncome ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                <span>{isIncome ? '+' : '-'}{t.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                              </>
                            )}
                          </div>

                          {/* Kompakt Bakiye Akış Rozeti (Seçenek 3) */}
                          {(() => {
                            const bal = transactionBalanceMap.get(t.id);
                            if (!bal) return null;
                            return (
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5 flex items-center justify-end gap-1 tracking-tight">
                                <span className="text-slate-500">Önce:</span>
                                <span className="text-slate-300 font-semibold">
                                  {isValuesHidden ? '***' : `${bal.before.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
                                </span>
                                <span className="text-indigo-400 font-bold">➔</span>
                                <span className="text-slate-500">Sonra:</span>
                                <span className={`font-bold ${bal.after >= 0 ? 'text-emerald-400/90' : 'text-rose-400/90'}`}>
                                  {isValuesHidden ? '***' : `${bal.after.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            {!t.isTransfer && (
                              <button
                                onClick={() => openEditModal(t)}
                                className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition cursor-pointer"
                                title="İşlemi Değiştir / Düzenle"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(t)}
                              className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                              title={t.isTransfer ? "Transferi Sil" : "İşlemi Sil"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500 text-xs">
                      İşlem kaydı bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>
              Sayfa {currentPage} / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Önceki</span>
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium transition flex items-center gap-1 cursor-pointer"
              >
                <span>Sonraki</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white">
                {editingId ? 'İşlemi Düzenle / Değiştir' : 'Yeni Finansal İşlem Ekle'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setType(TransactionType.Expense)}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    type === TransactionType.Expense
                      ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Hesap
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(Number(e.target.value))}
                    required
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.currentBalance.toFixed(2)} ₺)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Tutar (₺)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Ana Kategori
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value ? Number(e.target.value) : '');
                      setSubCategoryId('');
                    }}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Kategori Seçin</option>
                    {categories
                      .filter((c) => (type === TransactionType.Expense ? c.type !== CategoryType.Income : c.type !== CategoryType.Expense))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Alt Kategori
                  </label>
                  <select
                    value={subCategoryId}
                    onChange={(e) => setSubCategoryId(e.target.value ? Number(e.target.value) : '')}
                    disabled={!availableSubCategories.length}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
                  >
                    <option value="">Alt Kategori Seçin</option>
                    {availableSubCategories.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    İşlem Tarihi
                  </label>
                  <input
                    type="date"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    required
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Etiketler (Opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Örn: tatil, araba"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Açıklama
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="İşlem detayı..."
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingId ? 'Değişiklikleri Kaydet' : 'İşlemi Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Özel Profesyonel Onay Modalı */}
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
