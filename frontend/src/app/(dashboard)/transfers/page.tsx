'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/axios';
import { Transfer, Account, AccountType } from '@/types/finance';
import { PeriodSummary } from '@/types/credit-card';
import { useAuthStore } from '@/store/auth-store';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import { formatLocalDateToInput, toSafeApiDateString } from '@/lib/date-utils';
import { matchesSearch } from '@/lib/search-utils';
import {
  ArrowRightLeft,
  Plus,
  Trash2,
  Edit2,
  Pencil,
  ArrowRight,
  Loader2,
  Check,
  X,
  CreditCard,
  Calendar,
  AlertCircle,
  Search,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export default function TransfersPage() {
  const isValuesHidden = useAuthStore((state) => state.isValuesHidden);
  const toast = useToast();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFromAccount, setSelectedFromAccount] = useState<string>('');
  const [selectedToAccount, setSelectedToAccount] = useState<string>('');

  // Modal State (Create & Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fromAccountId, setFromAccountId] = useState<number | ''>('');
  const [toAccountId, setToAccountId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('');
  const [transferDate, setTransferDate] = useState(formatLocalDateToInput());
  const [description, setDescription] = useState('');
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>('');
  const [availablePeriods, setAvailablePeriods] = useState<PeriodSummary[]>([]);
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(false);
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
      setFetchError(null);
      const [transfersRes, accountsRes] = await Promise.all([
        api.get<Transfer[]>('/api/transfers'),
        api.get<Account[]>('/api/accounts'),
      ]);
      setTransfers(transfersRes.data);
      setAccounts(accountsRes.data);
    } catch (err: any) {
      const isNetErr = !err.response && (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error'));
      const msg = isNetErr
        ? 'Sunucu bağlantısı kurulamadı. API servisinin çalıştığından emin olun.'
        : 'Transfer kayıtları yüklenirken bir hata oluştu.';
      setFetchError(msg);
      console.warn('Transfer fetch warning:', msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch Credit Card Statement Periods when Target Account is a Credit Card
  useEffect(() => {
    const targetAcc = accounts.find((a) => a.id === Number(toAccountId));
    if (targetAcc && targetAcc.accountType === AccountType.CreditCard) {
      const fetchPeriods = async () => {
        try {
          setIsLoadingPeriods(true);
          const res = await api.get<PeriodSummary[]>(`/api/creditcardexpenses/periods?accountId=${targetAcc.id}`);
          setAvailablePeriods(res.data);
          if (res.data.length > 0 && !selectedPeriodKey) {
            setSelectedPeriodKey(res.data[0].periodKey);
          }
        } catch (err) {
          console.error('Failed to fetch credit card periods', err);
        } finally {
          setIsLoadingPeriods(false);
        }
      };
      fetchPeriods();
    } else {
      setAvailablePeriods([]);
      setSelectedPeriodKey('');
    }
  }, [toAccountId, accounts]);

  // Filtered Transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      if (selectedFromAccount && t.fromAccountId !== Number(selectedFromAccount)) return false;
      if (selectedToAccount && t.toAccountId !== Number(selectedToAccount)) return false;
      if (searchTerm) {
        const isMatch = matchesSearch([t.description], searchTerm);
        if (!isMatch) return false;
      }
      return true;
    });
  }, [transfers, selectedFromAccount, selectedToAccount, searchTerm]);

  const hasActiveFilters = Boolean(selectedFromAccount || selectedToAccount || searchTerm);

  const openCreateModal = () => {
    setEditingId(null);
    setFromAccountId(accounts[0]?.id || '');
    setToAccountId(accounts[1]?.id || '');
    setAmount('');
    setFee('');
    setTransferDate(formatLocalDateToInput());
    setDescription('');
    setSelectedPeriodKey('');
    setIsModalOpen(true);
  };

  const openEditModal = (t: Transfer) => {
    setEditingId(t.id);
    setFromAccountId(t.fromAccountId);
    setToAccountId(t.toAccountId);
    setAmount(t.amount.toString());
    setFee(t.fee ? t.fee.toString() : '');
    setTransferDate(formatLocalDateToInput(t.transferDate));
    setDescription(t.description || '');

    // Eğer hedef hesap kredi kartıysa ve transferin bir tarihi varsa dönem key'ini belirle
    const tDate = new Date(t.transferDate);
    const calculatedPeriodKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedPeriodKey(calculatedPeriodKey);

    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
      toast.warning('Lütfen farklı kaynak ve hedef hesaplar seçin.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        // Update Transfer
        await api.put(`/api/transfers/${editingId}`, {
          id: editingId,
          fromAccountId: Number(fromAccountId),
          toAccountId: Number(toAccountId),
          amount: parseFloat(amount) || 0,
          fee: fee ? parseFloat(fee) : null,
          transferDate: toSafeApiDateString(transferDate),
          description,
          periodKey: selectedPeriodKey || null,
        });
        toast.success('Transfer işlemi başarıyla güncellendi.');
      } else {
        // Create Transfer
        await api.post('/api/transfers', {
          fromAccountId: Number(fromAccountId),
          toAccountId: Number(toAccountId),
          amount: parseFloat(amount) || 0,
          fee: fee ? parseFloat(fee) : null,
          transferDate: toSafeApiDateString(transferDate),
          description,
          periodKey: selectedPeriodKey || null,
        });
        toast.success('Transfer işlemi başarıyla kaydedildi.');
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Failed to save transfer', err);
      toast.error('Transfer kaydedilirken hata oluştu: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Transferi Sil',
      message: 'Bu transfer hareketini silmek istediğinize emin misiniz? Hesap bakiyeleri önceki durumuna geri yüklenecektir.',
      onConfirm: async () => {
        try {
          await api.delete(`/api/transfers/${id}`);
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          fetchData();
        } catch (err) {
          console.error(err);
        }
      },
    });
  };

  const selectedFromAccountObj = accounts.find((a) => a.id === Number(fromAccountId));
  const fromBalance = selectedFromAccountObj ? selectedFromAccountObj.currentBalance : 0;
  const isAmountExceeding = Boolean(amount && Number(amount) > fromBalance && fromBalance > 0);
  const selectedTargetAccount = accounts.find((a) => a.id === Number(toAccountId));
  const isTargetCreditCard = selectedTargetAccount?.accountType === AccountType.CreditCard;

  return (
    <div>
      <Header
        title="Hesaplar Arası Transferler"
        description="Banka, nakit ve yatırım hesaplarınız arasındaki para transferleri, virman ve kredi kartı borç ödemeleri"
        actions={
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Transfer Yap</span>
          </button>
        }
      />

      {/* Network / Connection Error Banner */}
      {fetchError && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 mb-6 flex items-center justify-between gap-3 text-rose-300 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Yeniden Dene</span>
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 mb-6 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Açıklama ara..."
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* From Account Filter */}
          <select
            value={selectedFromAccount}
            onChange={(e) => setSelectedFromAccount(e.target.value)}
            className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tüm Kaynak Hesaplar</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* To Account Filter */}
          <select
            value={selectedToAccount}
            onChange={(e) => setSelectedToAccount(e.target.value)}
            className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tüm Hedef Hesaplar</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Clear Filters (X) */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSelectedFromAccount('');
                setSelectedToAccount('');
                setSearchTerm('');
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
          Toplam {filteredTransfers.length} transfer listelendi
        </span>
      </div>

      {/* Transfers List Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : filteredTransfers.length === 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-sm">
          Filtreye uygun transfer hareketi bulunamadı.
        </div>
      ) : (
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Tarih</th>
                  <th className="py-2.5 px-3">Kaynak Hesap</th>
                  <th className="py-2.5 px-3 text-center">İşlem</th>
                  <th className="py-2.5 px-3">Hedef Hesap</th>
                  <th className="py-2.5 px-3">Açıklama</th>
                  <th className="py-2.5 px-3 text-right">Tutar</th>
                  <th className="py-2.5 px-3 text-center w-20">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredTransfers.map((t) => {
                  const date = new Date(t.transferDate);
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition group">
                      <td className="py-2 px-3 text-slate-400 font-mono whitespace-nowrap">
                        {date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-300">
                        <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-md text-[11px]">
                          {t.fromAccountName}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 inline" />
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-300">
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md text-[11px]">
                          {t.toAccountName}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300 max-w-xs truncate">
                        {(() => {
                          const cleanDesc = (t.description || '').trim();
                          const isNoDesc = !cleanDesc || cleanDesc === '0' || cleanDesc.toLowerCase().startsWith('açıklama yok');
                          const hasFee = Boolean(t.fee && t.fee > 0);

                          return (
                            <>
                              {!isNoDesc && <span>{cleanDesc}</span>}
                              {hasFee ? (
                                <span className="text-[10px] text-slate-500 block font-mono">
                                  (Ücret: {t.fee!.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺)
                                </span>
                              ) : null}
                            </>
                          );
                        })()}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-white font-mono whitespace-nowrap">
                        {isValuesHidden ? (
                          '*** ₺'
                        ) : (
                          `${t.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => openEditModal(t)}
                            className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition cursor-pointer"
                            title="Transferi Değiştir / Düzenle"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                            title="Transferi Sil"
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

      {/* Create / Edit Transfer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {editingId ? 'Transferi Düzenle' : 'Yeni Transfer Yap'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Kaynak Hesap</label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(Number(e.target.value))}
                    required
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currentBalance.toLocaleString('tr-TR')} ₺)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Hedef Hesap</label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(Number(e.target.value))}
                    required
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currentBalance.toLocaleString('tr-TR')} ₺)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Credit Card Statement Period Selector if Target Account is a Credit Card */}
              {isTargetCreditCard && (
                <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                    <CreditCard className="w-4 h-4" />
                    <span>Kredi Kartı Borç Ödeme İlişkilendirmesi</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Ödemenin sayılmasını istediğiniz ekstre dönemini seçin:
                  </p>
                  {isLoadingPeriods ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                      <span>Dönemler yükleniyor...</span>
                    </div>
                  ) : availablePeriods.length > 0 ? (
                    <select
                      value={selectedPeriodKey}
                      onChange={(e) => setSelectedPeriodKey(e.target.value)}
                      className="w-full bg-slate-900 border border-emerald-700/50 rounded-lg px-3 py-2 text-emerald-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {availablePeriods.map((p) => (
                        <option key={p.periodKey} value={p.periodKey}>
                          {p.periodKey} Dönemi (Kalan Borç: {Math.max(0, p.periodDebt - p.totalPayment).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-[11px] text-amber-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Bu kart için kayıtlı ekstre dönemi bulunamadı. Genel ödeme olarak kaydedilecek.</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-400">Transfer Tutarı (₺)</label>
                  {selectedFromAccountObj && (
                    <button
                      type="button"
                      onClick={() => setAmount(Math.max(0, fromBalance).toFixed(2))}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 cursor-pointer font-medium"
                      title="Kaynak hesaptaki tüm bakiyeyi aktarmak için tıklayın"
                    >
                      <span className="text-slate-400">Bakiye:</span>
                      <span className="font-mono font-bold text-slate-200">
                        {isValuesHidden ? '***' : `${fromBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`}
                      </span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className={`w-full bg-slate-950/60 border rounded-xl pl-3 pr-20 py-2 text-white text-xs font-mono focus:outline-none focus:ring-2 transition ${
                      isAmountExceeding
                        ? 'border-amber-500/60 focus:ring-amber-500'
                        : 'border-slate-800 focus:ring-indigo-500'
                    }`}
                  />
                  {selectedFromAccountObj && (
                    <button
                      type="button"
                      onClick={() => setAmount(Math.max(0, fromBalance).toFixed(2))}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-indigo-500/15 hover:bg-indigo-500/25 active:scale-95 text-indigo-400 border border-indigo-500/30 rounded-lg text-[10px] font-bold font-mono transition cursor-pointer tracking-wider flex items-center gap-1"
                      title="Kaynak hesaptaki tüm tutarı doldur"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      <span>TÜMÜ</span>
                    </button>
                  )}
                </div>
                {isAmountExceeding && (
                  <p className="text-[11px] text-amber-400 mt-1.5 flex items-center gap-1 font-medium animate-in fade-in duration-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Girilen tutar kaynak hesap bakiyesini ({fromBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺) aşıyor.</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">İşlem Ücreti (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Transfer Tarihi</label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    required
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Açıklama / Not</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Örn: Yatırım hesabına para aktarımı..."
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingId ? 'Güncelle' : 'Transferi Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
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
