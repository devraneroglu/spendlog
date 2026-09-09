'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/axios';
import { FuelLog, FuelSummary, FuelLogsResponse, FuelPeriodKpi } from '@/types/fuel';
import { useAuthStore } from '@/store/auth-store';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import { formatLocalDateToInput, toSafeApiDateString } from '@/lib/date-utils';
import {
  Fuel,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  DollarSign,
  Gauge,
  MapPin,
  TrendingUp,
  Loader2,
  Search,
  Check,
  X,
  Bot,
  Activity,
  CalendarDays,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

type PeriodFilter = 'ALL' | 'THIS_YEAR' | 'THIS_MONTH' | 'PREV_YEAR';

export default function FuelTrackerPage() {
  const isValuesHidden = useAuthStore((state) => state.isValuesHidden);
  const toast = useToast();

  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [summary, setSummary] = useState<FuelSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('ALL');

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
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
  const [tarih, setTarih] = useState(formatLocalDateToInput());
  const [tutar, setTutar] = useState('');
  const [litreFiyat, setLitreFiyat] = useState('');
  const [miktarLitre, setMiktarLitre] = useState('');
  const [aracKm, setAracKm] = useState('');
  const [benzinlik, setBenzinlik] = useState('Shell');
  const [konum, setKonum] = useState('');
  const [not, setNot] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchFuelData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<FuelLogsResponse>('/api/fuellogs');
      setLogs(res.data.logs || []);
      setSummary(res.data.summary || null);
    } catch (err: any) {
      console.error('Failed to fetch fuel logs', err);
      toast.error('Yakıt verileri alınırken hata oluştu: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFuelData();
  }, []);

  const openCreateModal = () => {
    setEditingLog(null);
    setTarih(formatLocalDateToInput());
    setTutar('');
    setLitreFiyat('');
    setMiktarLitre('');
    const lastKm = logs.length > 0 ? logs[0].aracKm : 0;
    setAracKm(lastKm > 0 ? (lastKm + 450).toString() : '');
    setBenzinlik('Shell');
    setKonum('İSTANBUL-SANCAKTEPE-BİRBİLEN PETROL');
    setNot('');
    setIsModalOpen(true);
  };

  const openEditModal = (log: FuelLog) => {
    setEditingLog(log);
    setTarih(formatLocalDateToInput(new Date(log.tarih)));
    setTutar(log.tutar.toString());
    setLitreFiyat(log.litreFiyat.toString());
    setMiktarLitre(log.miktarLitre.toString());
    setAracKm(log.aracKm.toString());
    setBenzinlik(log.benzinlik || 'Shell');
    setKonum(log.konum || '');
    setNot(log.not || '');
    setIsModalOpen(true);
  };

  const handleTutarChange = (val: string) => {
    setTutar(val);
    const numTutar = parseFloat(val);
    const numLitreFiyat = parseFloat(litreFiyat);
    if (numTutar > 0 && numLitreFiyat > 0) {
      setMiktarLitre((numTutar / numLitreFiyat).toFixed(2));
    }
  };

  const handleLitreFiyatChange = (val: string) => {
    setLitreFiyat(val);
    const numTutar = parseFloat(tutar);
    const numLitreFiyat = parseFloat(val);
    if (numTutar > 0 && numLitreFiyat > 0) {
      setMiktarLitre((numTutar / numLitreFiyat).toFixed(2));
    }
  };

  const handleMiktarLitreChange = (val: string) => {
    setMiktarLitre(val);
    const numTutar = parseFloat(tutar);
    const numMiktar = parseFloat(val);
    if (numTutar > 0 && numMiktar > 0) {
      setLitreFiyat((numTutar / numMiktar).toFixed(2));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingLog) {
        await api.put(`/api/fuellogs/${editingLog.id}`, {
          id: editingLog.id,
          tarih: toSafeApiDateString(tarih),
          tutar: parseFloat(tutar) || 0,
          litreFiyat: parseFloat(litreFiyat) || 0,
          miktarLitre: parseFloat(miktarLitre) || 0,
          aracKm: parseInt(aracKm) || 0,
          benzinlik,
          konum,
          not,
        });
        toast.success('Yakıt kaydı başarıyla güncellendi.');
      } else {
        await api.post('/api/fuellogs', {
          tarih: toSafeApiDateString(tarih),
          tutar: parseFloat(tutar) || 0,
          litreFiyat: parseFloat(litreFiyat) || 0,
          miktarLitre: parseFloat(miktarLitre) || 0,
          aracKm: parseInt(aracKm) || 0,
          benzinlik,
          konum,
          not,
        });
        toast.success('Yeni yakıt kaydı başarıyla eklendi.');
      }
      setIsModalOpen(false);
      fetchFuelData();
    } catch (err: any) {
      console.error('Failed to save fuel log', err);
      toast.error('Kayıt sırasında hata: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number, desc: string) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Yakıt Kaydını Sil',
      message: `"${desc}" tarihli yakıt kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      onConfirm: async () => {
        try {
          await api.delete(`/api/fuellogs/${id}`);
          toast.success('Yakıt kaydı başarıyla silindi.');
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          fetchFuelData();
        } catch (err: any) {
          console.error('Failed to delete fuel log', err);
          toast.error('Silme hatası: ' + (err.response?.data?.detail || err.message));
        }
      },
    });
  };

  const currentYearNumber = new Date().getFullYear();
  const currentMonthNumber = new Date().getMonth() + 1;

  // Dönem Filtrelemesi
  const filteredLogs = useMemo(() => {
    let list = logs;

    if (selectedPeriod === 'THIS_MONTH') {
      list = list.filter((l) => {
        const d = new Date(l.tarih);
        return d.getFullYear() === currentYearNumber && d.getMonth() + 1 === currentMonthNumber;
      });
    } else if (selectedPeriod === 'THIS_YEAR') {
      list = list.filter((l) => {
        const d = new Date(l.tarih);
        return d.getFullYear() === currentYearNumber;
      });
    } else if (selectedPeriod === 'PREV_YEAR') {
      list = list.filter((l) => {
        const d = new Date(l.tarih);
        return d.getFullYear() === currentYearNumber - 1;
      });
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (l) =>
        (l.benzinlik && l.benzinlik.toLowerCase().includes(q)) ||
        (l.konum && l.konum.toLowerCase().includes(q)) ||
        (l.not && l.not.toLowerCase().includes(q)) ||
        l.aracKm.toString().includes(q) ||
        l.ay.toLowerCase().includes(q)
    );
  }, [logs, searchQuery, selectedPeriod, currentYearNumber, currentMonthNumber]);

  return (
    <div>
      <Header
        title="Yakıt & Araç Takibi"
        description="Tüketim analizleri, kilometre başına maliyet ve Telegram Vision AI destekli akıllı yakıt yönetimi"
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Yakıt Ekle</span>
            </button>
          </div>
        }
      />

      {/* HEADER: DÖNEM BAZLI KPI KARTLARI (BU AY / 2026 YILI / TÜM ZAMANLAR) */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* 1. KART: İÇİNDE BULUNDUĞUMUZ AY (AĞUSTOS 2026) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl border-t-4 border-t-emerald-500 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bu Ay ({summary.currentMonth.label})</span>
              </span>
              <span className="text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md font-semibold font-mono">
                {summary.currentMonth.logsCount} Dolum
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-2xl font-bold text-white font-mono">
                  {isValuesHidden
                    ? '*** ₺'
                    : `${summary.currentMonth.totalExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
                </p>
                <span className="text-xs text-slate-400 block mt-1">
                  {summary.currentMonth.totalLiters.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} LT Akaryakıt
                </span>
              </div>

              <div className="text-right">
                <p className="text-lg font-bold text-emerald-400 font-mono">
                  {isValuesHidden ? '***' : `${summary.currentMonth.averageCostPerKm.toFixed(2)} ₺/Km`}
                </p>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {summary.currentMonth.totalKilometers.toLocaleString('tr-TR')} Km Yol
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Ort. Tüketim: <strong className="text-slate-200">{summary.currentMonth.averageLitersPer100Km.toFixed(2)} LT / 100 Km</strong></span>
              <span>Ort. Litre: <strong className="text-amber-400">{summary.currentMonth.averageLiterPrice.toFixed(2)} ₺</strong></span>
            </div>
          </div>

          {/* 2. KART: İÇİNDE BULUNDUĞUMUZ YIL (2026 YILI TOPLAMI) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl border-t-4 border-t-indigo-500 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Bu Yıl ({summary.currentYear.label})</span>
              </span>
              <span className="text-[11px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md font-semibold font-mono">
                {summary.currentYear.logsCount} Dolum
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-2xl font-bold text-white font-mono">
                  {isValuesHidden
                    ? '*** ₺'
                    : `${summary.currentYear.totalExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
                </p>
                <span className="text-xs text-slate-400 block mt-1">
                  {summary.currentYear.totalLiters.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} LT Akaryakıt
                </span>
              </div>

              <div className="text-right">
                <p className="text-lg font-bold text-indigo-400 font-mono">
                  {isValuesHidden ? '***' : `${summary.currentYear.averageCostPerKm.toFixed(2)} ₺/Km`}
                </p>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {summary.currentYear.totalKilometers.toLocaleString('tr-TR')} Km Yol
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Ort. Tüketim: <strong className="text-slate-200">{summary.currentYear.averageLitersPer100Km.toFixed(2)} LT / 100 Km</strong></span>
              <span>Ort. Litre: <strong className="text-amber-400">{summary.currentYear.averageLiterPrice.toFixed(2)} ₺</strong></span>
            </div>
          </div>

          {/* 3. KART: TÜM ZAMANLAR (GENEL TOPLAM) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl border-t-4 border-t-purple-500 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-purple-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Tüm Zamanlar (Genel)</span>
              </span>
              <span className="text-[11px] bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-md font-semibold font-mono">
                {summary.totalLogsCount} Dolum
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-2xl font-bold text-white font-mono">
                  {isValuesHidden
                    ? '*** ₺'
                    : `${summary.totalExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
                </p>
                <span className="text-xs text-slate-400 block mt-1">
                  {summary.totalLiters.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} LT Akaryakıt
                </span>
              </div>

              <div className="text-right">
                <p className="text-lg font-bold text-purple-400 font-mono">
                  {isValuesHidden ? '***' : `${summary.averageCostPerKm.toFixed(2)} ₺/Km`}
                </p>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {summary.totalKilometers.toLocaleString('tr-TR')} Km Yol
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>En Çok: <strong className="text-white truncate max-w-[120px]">{summary.topStation || 'Shell'}</strong></span>
              <span>Genel Litre: <strong className="text-amber-400">{summary.averageLiterPrice.toFixed(2)} ₺</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Tüketim & Harcama Trend Grafiği */}
      {summary && summary.monthlyTrend.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 mb-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Aylık Yakıt Harcama & Km Maliyet Trendi</span>
              </h3>
              <p className="text-xs text-slate-500">2025 ve 2026 aylarına göre toplam harcama ve kilometre başına düşen maliyet (₺/Km)</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.monthlyTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `${val}₺`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(val: any, name: any) => [
                    `${Number(val).toLocaleString('tr-TR')} ₺`,
                    name === 'totalAmount' ? 'Toplam Harcama' : name,
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="totalAmount"
                  name="totalAmount"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorAmount)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* DÖNEM FİLTRELEME BUTONLARI & TABLO */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90">
          {/* Dönem Filtre Butonları */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setSelectedPeriod('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedPeriod === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Tüm Zamanlar ({logs.length})
            </button>
            <button
              onClick={() => setSelectedPeriod('THIS_YEAR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedPeriod === 'THIS_YEAR'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              2026 (Bu Yıl)
            </button>
            <button
              onClick={() => setSelectedPeriod('THIS_MONTH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedPeriod === 'THIS_MONTH'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Bu Ay (Ağustos)
            </button>
            <button
              onClick={() => setSelectedPeriod('PREV_YEAR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedPeriod === 'PREV_YEAR'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              2025 Yılı
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="İstasyon, konum veya km ara..."
              className="bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-3.5 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3.5">Ay</th>
                <th className="py-3 px-3.5">Tarih</th>
                <th className="py-3 px-3.5 text-right">Tutar (₺)</th>
                <th className="py-3 px-3.5 text-right">Litre Fiyatı (₺)</th>
                <th className="py-3 px-3.5 text-right">Miktar (LT)</th>
                <th className="py-3 px-3.5 text-right">Araç (Km)</th>
                <th className="py-3 px-3.5 text-right">Gidilen Km</th>
                <th className="py-3 px-3.5 text-right">Ort. Tüketim</th>
                <th className="py-3 px-3.5 text-center">Sıklık</th>
                <th className="py-3 px-3.5">Benzinlik</th>
                <th className="py-3 px-3.5">Konum</th>
                <th className="py-3 px-3.5">Not</th>
                <th className="py-3 px-3.5 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={13} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" />
                  </td>
                </tr>
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map((l) => {
                  const date = new Date(l.tarih);
                  return (
                    <tr key={l.id} className="hover:bg-slate-800/40 transition group">
                      <td className="py-2.5 px-3.5 font-semibold text-slate-300">{l.ay}</td>
                      <td className="py-2.5 px-3.5 text-slate-400 font-mono whitespace-nowrap">
                        {date.toLocaleDateString('tr-TR')}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-white font-mono whitespace-nowrap">
                        {isValuesHidden
                          ? '*** ₺'
                          : `${l.tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-amber-400 font-mono font-semibold whitespace-nowrap">
                        {l.litreFiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-slate-300 font-mono whitespace-nowrap">
                        {l.miktarLitre.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} LT
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-indigo-300 font-mono font-bold whitespace-nowrap">
                        {l.aracKm.toLocaleString('tr-TR')}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono text-emerald-400 font-semibold whitespace-nowrap">
                        {l.gidilenKm ? `+${l.gidilenKm.toLocaleString('tr-TR')} km` : '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono whitespace-nowrap">
                        {l.ortalamaTuketimTL ? (
                          <div>
                            <span className="font-bold text-white block">
                              {l.ortalamaTuketimTL.toFixed(2)} ₺/km
                            </span>
                            {l.ortalamaTuketimLt && (
                              <span className="text-[10px] text-slate-500 block">
                                {l.ortalamaTuketimLt.toFixed(2)} L/100km
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-center text-slate-400 whitespace-nowrap">
                        {l.alisSikligiGun !== null && l.alisSikligiGun !== undefined ? (
                          <span className="text-[11px] bg-slate-800/80 px-2 py-0.5 rounded-md font-medium">
                            {l.alisSikligiGun} Gün
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span className="font-semibold text-white bg-slate-800/60 border border-slate-700/60 px-2.5 py-1 rounded-lg">
                          {l.benzinlik || 'Shell'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-400 max-w-xs truncate" title={l.konum || ''}>
                        {l.konum || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-400 max-w-xs truncate" title={l.not || ''}>
                        {l.not || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => openEditModal(l)}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="Düzenle"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(l.id, `${date.toLocaleDateString('tr-TR')} - ${l.tutar} ₺`)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                            title="Sil"
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
                  <td colSpan={13} className="text-center py-12 text-slate-500 text-xs">
                    Seçilen dönemde kayıtlı akaryakıt dolumu bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fuel Log Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">
                {editingLog ? 'Yakıt Kaydını Düzenle' : 'Yeni Yakıt Dolumu Ekle'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Tarih
                </label>
                <input
                  type="date"
                  value={tarih}
                  onChange={(e) => setTarih(e.target.value)}
                  required
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Toplam Tutar (₺)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={tutar}
                    onChange={(e) => handleTutarChange(e.target.value)}
                    required
                    placeholder="500.00"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Litre Fiyatı (₺)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={litreFiyat}
                    onChange={(e) => handleLitreFiyatChange(e.target.value)}
                    required
                    placeholder="19.01"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Miktar (Litre)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={miktarLitre}
                    onChange={(e) => handleMiktarLitreChange(e.target.value)}
                    required
                    placeholder="26.30"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Araç Kilometresi (Km)
                  </label>
                  <input
                    type="number"
                    value={aracKm}
                    onChange={(e) => setAracKm(e.target.value)}
                    required
                    placeholder="93480"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold text-indigo-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Benzinlik / İstasyon
                  </label>
                  <input
                    type="text"
                    value={benzinlik}
                    onChange={(e) => setBenzinlik(e.target.value)}
                    placeholder="Shell, Opet, BP..."
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Konum / Şube
                  </label>
                  <input
                    type="text"
                    value={konum}
                    onChange={(e) => setKonum(e.target.value)}
                    placeholder="SANCAKTEPE - BİRBİLEN PETROL"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Not (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={not}
                  onChange={(e) => setNot(e.target.value)}
                  placeholder="Uzun yol / tatil dolumu"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingLog ? 'Güncelle' : 'Kaydet'}</span>
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
