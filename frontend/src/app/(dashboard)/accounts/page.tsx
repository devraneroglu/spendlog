'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/axios';
import { Account, AccountType, Currency } from '@/types/finance';
import { useAuthStore } from '@/store/auth-store';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import {
  Wallet,
  Landmark,
  CreditCard,
  TrendingUp,
  Coins,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Check,
  X,
  LayoutGrid,
  List,
  Rows,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

const ACCOUNT_TYPE_LABELS: Record<AccountType, { label: string; icon: any }> = {
  [AccountType.Cash]: { label: 'Nakit Cüzdan', icon: Wallet },
  [AccountType.Bank]: { label: 'Vadesiz Banka', icon: Landmark },
  [AccountType.CreditCard]: { label: 'Kredi Kartı', icon: CreditCard },
  [AccountType.Investment]: { label: 'Yatırım Hesabı', icon: TrendingUp },
  [AccountType.Crypto]: { label: 'Kripto Cüzdan', icon: Coins },
  [AccountType.Other]: { label: 'Diğer', icon: Wallet },
};

export default function AccountsPage() {
  const isValuesHidden = useAuthStore((state) => state.isValuesHidden);
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('list');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('');

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

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>(AccountType.Bank);
  const [currency, setCurrency] = useState<Currency>(Currency.TRY);
  const [initialBalance, setInitialBalance] = useState<string>('0');
  const [color, setColor] = useState('#3b82f6');
  const [iban, setIban] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<Account[]>('/api/accounts');
      setAccounts(res.data);
    } catch (err) {
      console.error('Failed to fetch accounts', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecalculateBalances = async () => {
    try {
      setIsRecalculating(true);
      await api.post('/api/accounts/recalculate-all');
      await fetchAccounts();
    } catch (err) {
      console.error('Failed to recalculate balances', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const openCreateModal = () => {
    setEditingAccount(null);
    setName('');
    setAccountType(AccountType.Bank);
    setCurrency(Currency.TRY);
    setInitialBalance('0');
    setColor('#3b82f6');
    setIban('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (acc: Account) => {
    setEditingAccount(acc);
    setName(acc.name);
    setAccountType(acc.accountType);
    setCurrency(acc.currency);
    setInitialBalance(acc.initialBalance.toString());
    setColor(acc.color || '#3b82f6');
    setIban(acc.iban || '');
    setDescription(acc.description || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingAccount) {
        await api.put(`/api/accounts/${editingAccount.id}`, {
          id: editingAccount.id,
          name,
          accountType,
          currency,
          color,
          icon: 'wallet',
          iban,
          cardNumberMasked: '',
          isActive: true,
          description,
        });
      } else {
        await api.post('/api/accounts', {
          name,
          accountType,
          currency,
          initialBalance: parseFloat(initialBalance) || 0,
          color,
          icon: 'wallet',
          iban,
          cardNumberMasked: '',
          description,
        });
      }
      setIsModalOpen(false);
      toast.success(editingAccount ? 'Hesap başarıyla güncellendi.' : 'Hesap başarıyla oluşturuldu.');
      fetchAccounts();
    } catch (err: any) {
      console.error('Failed to save account', err);
      toast.error('Hesap kaydedilirken hata oluştu: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number, accName: string) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Hesabı Sil',
      message: `"${accName}" hesabını ve hesaba ait tüm geçmişi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      onConfirm: async () => {
        try {
          await api.delete(`/api/accounts/${id}`);
          toast.success(`"${accName}" hesabı başarıyla silindi.`);
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          fetchAccounts();
        } catch (err: any) {
          console.error('Failed to delete account', err);
          toast.error('Hesap silinirken hata oluştu: ' + (err.response?.data?.detail || err.message));
        }
      },
    });
  };

  const totalBankBalance = useMemo(() => {
    return accounts
      .filter((a) => a.accountType === AccountType.Bank)
      .reduce((acc, curr) => acc + curr.currentBalance, 0);
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (filterType && acc.accountType !== parseInt(filterType)) return false;
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        return acc.name.toLowerCase().includes(lower) || (acc.iban || '').toLowerCase().includes(lower);
      }
      return true;
    });
  }, [accounts, filterType, searchTerm]);

  return (
    <div className="space-y-6">
      <Header
        title="Hesaplar ve Varlıklar"
        description="Banka, nakit, kredi kartı ve yatırım hesaplarınızı tek noktadan yönetin"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRecalculateBalances}
              disabled={isRecalculating}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer border border-slate-700/60 disabled:opacity-50"
              title="Tüm hareketleri tarayarak hesap bakiyelerini kuruşu kuruşuna senkronize et"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>{isRecalculating ? 'Eşitleniyor...' : 'Bakiyeleri Eşitle'}</span>
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Hesap Ekle</span>
            </button>
          </div>
        }
      />

      {/* 1. HEADER KPI PANELİ - Sadece Vadesiz Banka Hesapları Toplamı */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Landmark className="w-4 h-4 text-indigo-400" />
            <span>Vadesiz Banka Hesap Özeti</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Toplam {accounts.filter((a) => a.accountType === AccountType.Bank).length} Vadesiz Banka Hesabı
          </span>
        </div>

        <div className="max-w-sm">
          <div className="bg-slate-950/60 border-l-4 border-emerald-500 border border-slate-800/80 rounded-xl p-4 transition hover:bg-slate-950/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Toplam Vadesiz Banka Bakiyesi</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Landmark className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-400 mt-1.5 tracking-tight font-mono">
              {isValuesHidden ? '*** ₺' : `${totalBankBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Sadece Vadesiz Mevduat Banka Hesapları</span>
          </div>
        </div>
      </div>

      {/* 2. HESAPLAR KONTROL BARI & DİNAMİK GÖRÜNÜM SEÇİCİ */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 shadow-md">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Arama */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Hesap veya IBAN ara..."
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-3.5 py-1.5 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Tür Filtresi */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tüm Hesap Türleri</option>
            <option value={AccountType.Bank}>Vadesiz Banka</option>
            <option value={AccountType.Cash}>Nakit Cüzdan</option>
            <option value={AccountType.CreditCard}>Kredi Kartı</option>
            <option value={AccountType.Investment}>Yatırım Hesabı</option>
            <option value={AccountType.Crypto}>Kripto Cüzdan</option>
          </select>
        </div>

        {/* Görünüm Değiştirici Butonları */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewMode('grid')}
            title="Kart Görünümü"
            className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'grid'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Kartlar</span>
          </button>

          <button
            onClick={() => setViewMode('list')}
            title="Detaylı Liste / Tablo Görünümü"
            className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'list'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Liste</span>
          </button>

          <button
            onClick={() => setViewMode('compact')}
            title="Kompakt Yatay Görünüm"
            className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'compact'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Rows className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Kompakt</span>
          </button>
        </div>
      </div>

      {/* 3. DİNAMİK HESAP GÖRÜNÜMLERİ */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-sm">
          Arama kriterinize uygun hesap bulunamadı.
        </div>
      ) : (
        <>
          {/* A) GRID / KART GÖRÜNÜMÜ */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAccounts.map((acc) => {
                const typeInfo = ACCOUNT_TYPE_LABELS[acc.accountType] || { label: 'Diğer', icon: Wallet };
                const Icon = typeInfo.icon;
                const isCredit = acc.accountType === AccountType.CreditCard;

                return (
                  <div
                    key={acc.id}
                    className="bg-slate-900/90 border border-slate-800/80 hover:border-indigo-500/40 rounded-2xl p-5 shadow-lg transition flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center shadow-inner"
                            style={{ backgroundColor: `${acc.color || '#3b82f6'}25`, color: acc.color || '#3b82f6' }}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-sm group-hover:text-indigo-300 transition">
                              {acc.name}
                            </h3>
                            <span className="text-[11px] font-medium text-slate-400">{typeInfo.label}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(acc)}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="Hesabı Düzenle"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(acc.id, acc.name)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                            title="Hesabı Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {acc.iban && (
                        <p className="text-[11px] font-mono text-slate-500 mb-2 truncate">IBAN: {acc.iban}</p>
                      )}
                      {acc.description && <p className="text-xs text-slate-400 mb-2">{acc.description}</p>}
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-baseline justify-between mt-2">
                      <span className="text-xs text-slate-400 font-medium">{isCredit ? 'Borç Bakiyesi' : 'Bakiye'}</span>
                      <span
                        className={`text-xl font-bold tracking-tight font-mono ${
                          isCredit ? 'text-red-400' : acc.currentBalance >= 0 ? 'text-white' : 'text-red-400'
                        }`}
                      >
                        {isValuesHidden
                          ? '*** ₺'
                          : `${acc.currentBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* B) LİSTE / TABLO GÖRÜNÜMÜ */}
          {viewMode === 'list' && (
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Hesap Adı</th>
                      <th className="py-2.5 px-3">Tür</th>
                      <th className="py-2.5 px-3">IBAN / Not</th>
                      <th className="py-2.5 px-3 text-right">Güncel Bakiye</th>
                      <th className="py-2.5 px-3 text-center w-20">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {filteredAccounts.map((acc) => {
                      const typeInfo = ACCOUNT_TYPE_LABELS[acc.accountType] || { label: 'Diğer', icon: Wallet };
                      const Icon = typeInfo.icon;
                      const isCredit = acc.accountType === AccountType.CreditCard;

                      return (
                        <tr key={acc.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${acc.color || '#3b82f6'}25`, color: acc.color || '#3b82f6' }}
                              >
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <span className="font-bold text-white text-xs">{acc.name}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="text-[11px] font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">
                              {typeInfo.label}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-400 font-mono whitespace-nowrap">
                            {acc.iban || acc.description || '-'}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-bold text-xs font-mono whitespace-nowrap ${
                              isCredit ? 'text-red-400' : acc.currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {isValuesHidden
                              ? '*** ₺'
                              : `${acc.currentBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEditModal(acc)}
                                className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                title="Hesabı Düzenle"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(acc.id, acc.name)}
                                className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                                title="Hesabı Sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* C) KOMPAKT GÖRÜNÜM */}
          {viewMode === 'compact' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredAccounts.map((acc) => {
                const typeInfo = ACCOUNT_TYPE_LABELS[acc.accountType] || { label: 'Diğer', icon: Wallet };
                const Icon = typeInfo.icon;
                const isCredit = acc.accountType === AccountType.CreditCard;

                return (
                  <div
                    key={acc.id}
                    className="bg-slate-900/80 border border-slate-800/80 rounded-xl py-2 px-3 flex items-center justify-between hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${acc.color || '#3b82f6'}25`, color: acc.color || '#3b82f6' }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-xs">{acc.name}</h4>
                        <span className="text-[10px] text-slate-500">{typeInfo.label}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span
                        className={`font-bold text-xs font-mono ${
                          isCredit ? 'text-red-400' : 'text-white'
                        }`}
                      >
                        {isValuesHidden
                          ? '*** ₺'
                          : `${acc.currentBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
                      </span>

                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => openEditModal(acc)}
                          className="p-1 text-slate-400 hover:text-indigo-400 rounded transition cursor-pointer"
                          title="Düzenle"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(acc.id, acc.name)}
                          className="p-1 text-slate-400 hover:text-red-400 rounded transition cursor-pointer"
                          title="Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Account Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">
                {editingAccount ? 'Hesabı Düzenle' : 'Yeni Hesap Ekle'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Hesap Adı
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Örn: Garanti Vadesiz"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Hesap Türü
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(parseInt(e.target.value))}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={AccountType.Bank}>Vadesiz Banka</option>
                    <option value={AccountType.Cash}>Nakit Cüzdan</option>
                    <option value={AccountType.CreditCard}>Kredi Kartı</option>
                    <option value={AccountType.Investment}>Yatırım Hesabı</option>
                    <option value={AccountType.Crypto}>Kripto Cüzdan</option>
                    <option value={AccountType.Other}>Diğer</option>
                  </select>
                </div>

                {!editingAccount && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Başlangıç Bakiyesi
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  IBAN (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="TR..."
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Kart Rengi
                  </label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full h-10 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer p-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Para Birimi
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(parseInt(e.target.value))}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={Currency.TRY}>₺ TRY</option>
                    <option value={Currency.USD}>$ USD</option>
                    <option value={Currency.EUR}>€ EUR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Açıklama / Not
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Hesap hakkında notlar..."
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
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
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingAccount ? 'Güncelle' : 'Kaydet'}</span>
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
