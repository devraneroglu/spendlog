'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/axios';
import { PriceAlert, PriceAlertCondition, PortfolioItem } from '@/types/portfolio';
import { AssetType, Currency } from '@/types/finance';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  Bell,
  BellRing,
  BellOff,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Search,
  Filter,
  SlidersHorizontal,
  Bot,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Wallet,
} from 'lucide-react';

const ASSET_TYPE_NAMES: Record<AssetType, string> = {
  [AssetType.Stock]: 'Hisse Senedi',
  [AssetType.Crypto]: 'Kripto Para',
  [AssetType.Commodity]: 'Altın & Emtia',
  [AssetType.ETF]: 'Yatırım Fonu (ETF)',
  [AssetType.Bond]: 'Tahvil & Bono',
};

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  [Currency.TRY]: '₺',
  [Currency.USD]: '$',
  [Currency.EUR]: '€',
  [Currency.GBP]: '£',
  [Currency.BTC]: '₿',
  [Currency.ETH]: 'Ξ',
};

function PriceAlertsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // State
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>(AssetType.Stock);
  const [currency, setCurrency] = useState<Currency>(Currency.TRY);
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState<PriceAlertCondition>(PriceAlertCondition.AboveOrEqual);
  const [note, setNote] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  // Filter & Search State
  const [tab, setTab] = useState<'ACTIVE' | 'TRIGGERED' | 'ALL'>('ACTIVE');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Delete Confirm Modal
  const [confirmModal, setConfirmModal] = useState<{
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

  // URL query params handler
  useEffect(() => {
    const qSymbol = searchParams.get('symbol');
    const qName = searchParams.get('name');
    const qPrice = searchParams.get('price');
    const qAssetType = searchParams.get('assetType');
    const qCurrency = searchParams.get('currency');

    if (qSymbol) setSymbol(qSymbol.toUpperCase());
    if (qName) setName(qName);
    if (qAssetType) setAssetType(Number(qAssetType) as AssetType);
    if (qCurrency) setCurrency(Number(qCurrency) as Currency);
    if (qPrice) {
      const num = parseFloat(qPrice);
      if (!isNaN(num) && num > 0) {
        setTargetPrice((num * 1.05).toFixed(2));
      }
    }
  }, [searchParams]);

  // Fetch Alerts
  const fetchAlerts = async () => {
    try {
      const res = await api.get<PriceAlert[]>('/api/pricealerts');
      setAlerts(res.data || []);
    } catch (err: any) {
      console.error('Alarmlar yüklenemedi:', err);
      toast.error('Alarmlar yüklenemedi: ' + (err.response?.data?.message || err.message));
    }
  };

  // Fetch Portfolio Items for quick selection
  const fetchPortfolioItems = async () => {
    try {
      const res = await api.get<PortfolioItem[]>('/api/portfolio');
      setPortfolioItems(res.data?.filter((i) => i.isActive) || []);
    } catch (err) {
      console.error('Portföy varlıkları yüklenemedi:', err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([fetchAlerts(), fetchPortfolioItems()]);
      setIsLoading(false);
    };
    loadAll();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAlerts();
    setIsRefreshing(false);
    toast.success('Fiyat alarmları güncellendi.');
  };

  // Pre-fill from selected portfolio item
  const handleSelectPortfolioAsset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;

    const item = portfolioItems.find((p) => p.symbol === val || String(p.id) === val);
    if (item) {
      setSymbol(item.symbol.toUpperCase());
      setName(item.name);
      setAssetType(item.assetType);
      setCurrency(item.currency);
      const basePrice = item.currentPrice > 0 ? item.currentPrice : item.purchasePrice;
      if (basePrice > 0) {
        setTargetPrice((basePrice * 1.1).toFixed(2));
      }
      setNote('Kâr al / Takip seviyesi');
    }
  };

  // Create Alert
  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !targetPrice || parseFloat(targetPrice) <= 0) {
      toast.warning('Lütfen geçerli bir varlık sembolü ve hedef fiyat girin.');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/api/pricealerts', {
        symbol: symbol.toUpperCase().trim(),
        name: name.trim() || symbol.toUpperCase().trim(),
        assetType,
        currency,
        targetPrice: parseFloat(targetPrice),
        condition,
        note: note.trim() || null,
        isRecurring,
      });

      toast.success(`${symbol.toUpperCase()} için fiyat alarmı başarıyla kuruldu!`);
      setSymbol('');
      setName('');
      setTargetPrice('');
      setNote('');
      setIsRecurring(false);
      await fetchAlerts();
    } catch (err: any) {
      console.error('Alarm kurulamadı:', err);
      toast.error('Fiyat alarmı kaydedilemedi: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Alert Active / Inactive
  const handleToggle = async (id: number) => {
    try {
      await api.patch(`/api/pricealerts/${id}/toggle`);
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, isActive: !a.isActive, isTriggered: a.isActive ? a.isTriggered : false } : a
        )
      );
      toast.success('Alarm durumu güncellendi.');
    } catch (err: any) {
      toast.error('Alarm durumu değiştirilemedi: ' + (err.response?.data?.message || err.message));
    }
  };

  // Reactivate a triggered alert
  const handleReactivate = async (alert: PriceAlert) => {
    try {
      await api.put(`/api/pricealerts/${alert.id}`, {
        id: alert.id,
        symbol: alert.symbol,
        name: alert.name,
        assetType: alert.assetType,
        currency: alert.currency,
        targetPrice: alert.targetPrice,
        condition: alert.condition,
        note: alert.note,
        isRecurring: alert.isRecurring,
        isActive: true,
        isTriggered: false,
      });
      await fetchAlerts();
      toast.success(`${alert.symbol} alarmı yeniden aktif edildi.`);
    } catch (err: any) {
      toast.error('Alarm yeniden başlatılamadı.');
    }
  };

  // Delete Alert
  const handleDelete = (alert: PriceAlert) => {
    setConfirmModal({
      isOpen: true,
      title: 'Fiyat Alarmını Sil',
      message: `"${alert.symbol}" (${alert.name}) için kurulan ${alert.targetPrice.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
      })} ${CURRENCY_SYMBOLS[alert.currency] || '₺'} hedefli alarmı silmek istediğinize emin misiniz?`,
      onConfirm: async () => {
        try {
          await api.delete(`/api/pricealerts/${alert.id}`);
          setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
          toast.success('Alarm silindi.');
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          toast.error('Alarm silinemedi: ' + (err.response?.data?.message || err.message));
        }
      },
    });
  };

  // Filtered List
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      // Tab filter
      if (tab === 'ACTIVE' && (!a.isActive || a.isTriggered)) return false;
      if (tab === 'TRIGGERED' && (!a.isTriggered && a.isActive)) return false;

      // Type filter
      if (typeFilter !== 'ALL' && a.assetType !== Number(typeFilter)) return false;

      // Search filter
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        const symMatch = a.symbol.toLowerCase().includes(lower);
        const nameMatch = a.name.toLowerCase().includes(lower);
        const noteMatch = (a.note || '').toLowerCase().includes(lower);
        if (!symMatch && !nameMatch && !noteMatch) return false;
      }

      return true;
    });
  }, [alerts, tab, typeFilter, searchTerm]);

  // Counts
  const activeCount = useMemo(() => alerts.filter((a) => a.isActive && !a.isTriggered).length, [alerts]);
  const triggeredCount = useMemo(() => alerts.filter((a) => a.isTriggered || !a.isActive).length, [alerts]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <Header
        title="Fiyat Alarmları & Bildirimler"
        description="Hedef fiyatlara ulaşıldığında anlık Telegram alarmları ve bildirim otomasyonu"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Yenile</span>
            </button>

            <button
              onClick={() => {
                const el = document.getElementById('new-alert-form');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 text-xs font-bold px-4 py-2 rounded-xl shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Alarm Kur</span>
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Toplam Alarm */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Toplam Alarm</span>
            <div className="p-2 rounded-xl bg-slate-800/80 text-slate-300">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2 font-mono">{alerts.length}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Tüm kayıtlı varlık alarmları</span>
        </div>

        {/* Aktif Alarmlar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Canlı İzlenen Alarmlar</span>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <BellRing className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2 font-mono">{activeCount}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Piyasada hedefe ulaşması beklenen</span>
        </div>

        {/* Tetiklenen Alarmlar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Tetiklenen / Geçmiş</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-indigo-400 mt-2 font-mono">{triggeredCount}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Hedefe ulaşmış veya pasif alarmlar</span>
        </div>

        {/* Telegram Durumu */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Telegram Entegrasyonu</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-base font-bold text-emerald-400">Aktif & Bağlı</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Tetiklendiğinde anında bot mesajı iletilir</span>
        </div>
      </div>

      {/* Yeni Fiyat Alarmı Kur Paneli */}
      <div
        id="new-alert-form"
        className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Yeni Fiyat Alarmı Oluştur</h3>
              <p className="text-xs text-slate-400">
                Piyasa fiyatı hedeflediğiniz seviyeye ulaştığında anında haberdar olun
              </p>
            </div>
          </div>

          {/* Portföyümden Hızlı Seç Dropdown */}
          {portfolioItems.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Portföyümden Seç:</span>
              <select
                onChange={handleSelectPortfolioAsset}
                defaultValue=""
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-indigo-300 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="" disabled>
                  Varlık Seçin...
                </option>
                {portfolioItems.map((p) => (
                  <option key={p.id} value={p.symbol}>
                    {p.symbol} - {p.name} ({ASSET_TYPE_NAMES[p.assetType]})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <form onSubmit={handleCreateAlert} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Varlık Sembolü */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Varlık Sembolü <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="Örn: THYAO, BTC, GRAM-ALTIN"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
              />
            </div>

            {/* Varlık Adı */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Varlık Adı (Opsiyonel)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Türk Hava Yolları, Bitcoin"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
              />
            </div>

            {/* Varlık Türü */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Varlık Türü</label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(Number(e.target.value) as AssetType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 transition cursor-pointer"
              >
                <option value={AssetType.Stock}>Hisse Senedi</option>
                <option value={AssetType.Crypto}>Kripto Para</option>
                <option value={AssetType.Commodity}>Altın & Emtia</option>
                <option value={AssetType.ETF}>Yatırım Fonu (ETF)</option>
                <option value={AssetType.Bond}>Tahvil & Bono</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Tetiklenme Koşulu */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tetiklenme Koşulu</label>
              <select
                value={condition}
                onChange={(e) => setCondition(Number(e.target.value) as PriceAlertCondition)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 transition cursor-pointer"
              >
                <option value={PriceAlertCondition.AboveOrEqual}>▲ Hedefe Ulaşınca / Üzerine Çıkınca (≥)</option>
                <option value={PriceAlertCondition.BelowOrEqual}>▼ Hedefin Altına Düşünce (≤)</option>
              </select>
            </div>

            {/* Hedef Fiyat */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Hedef Fiyat <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="any"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="Örn: 350.50 veya 95000"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
              />
            </div>

            {/* Para Birimi */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Para Birimi</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(Number(e.target.value) as Currency)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 transition cursor-pointer"
              >
                <option value={Currency.TRY}>₺ TRY</option>
                <option value={Currency.USD}>$ USD</option>
                <option value={Currency.EUR}>€ EUR</option>
                <option value={Currency.GBP}>£ GBP</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            {/* Alarm Notu */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Alarm Notu (Opsiyonel)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Örn: Kâr al seviyesi / Dip alım fırsatı / Direnç kırılımı"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
              />
            </div>

            {/* Alarm Kur Butonu */}
            <div>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                <span>Alarmı Kur</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Alarmlar Listesi & Filtreleme */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        {/* Sekmeler ve Filtreler */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          {/* Sekmeler */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setTab('ACTIVE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tab === 'ACTIVE'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Aktif Alarmlar ({activeCount})
            </button>
            <button
              onClick={() => setTab('TRIGGERED')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tab === 'TRIGGERED'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tetiklenen / Geçmiş ({triggeredCount})
            </button>
            <button
              onClick={() => setTab('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tab === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tümü ({alerts.length})
            </button>
          </div>

          {/* Arama & Tür Filtresi */}
          <div className="flex items-center gap-2">
            {/* Arama Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Sembol veya not ara..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Tür Filtresi */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="ALL">Tüm Türler</option>
              <option value={String(AssetType.Stock)}>Hisse Senedi</option>
              <option value={String(AssetType.Crypto)}>Kripto Para</option>
              <option value={String(AssetType.Commodity)}>Altın & Emtia</option>
              <option value={String(AssetType.ETF)}>Yatırım Fonu</option>
              <option value={String(AssetType.Bond)}>Tahvil & Bono</option>
            </select>
          </div>
        </div>

        {/* Alarmlar Tablosu */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-amber-400 text-xs font-semibold">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Fiyat alarmları yükleniyor...</span>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-10 text-center space-y-2">
            <BellOff className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">
              {tab === 'ACTIVE'
                ? 'Aktif fiyat alarmı bulunmuyor.'
                : tab === 'TRIGGERED'
                ? 'Geçmişte tetiklenen fiyat alarmı bulunmuyor.'
                : 'Kayıtlı fiyat alarmı bulunamadı.'}
            </p>
            <p className="text-xs text-slate-500">
              Yukarıdaki formdan dilediğiniz hisse veya kripto için anında fiyat alarmı kurabilirsiniz.
            </p>
          </div>
        ) : (
          <div className="border border-slate-800/80 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Koşul</th>
                    <th className="py-3 px-4">Varlık</th>
                    <th className="py-3 px-4">Tür</th>
                    <th className="py-3 px-4 text-right">Hedef Fiyat</th>
                    <th className="py-3 px-4">Alarm Notu</th>
                    <th className="py-3 px-4">Durum / Zaman</th>
                    <th className="py-3 px-4 text-center">Aksiyonlar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredAlerts.map((a) => {
                    const curSym = CURRENCY_SYMBOLS[a.currency] || '₺';
                    const isAbove = a.condition === PriceAlertCondition.AboveOrEqual;

                    return (
                      <tr key={a.id} className="hover:bg-slate-800/30 transition">
                        {/* Koşul İkonu */}
                        <td className="py-3 px-4">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                              a.isTriggered
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                : isAbove
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}
                            title={isAbove ? 'Hedefe Ulaşınca / Üzerine Çıkınca (≥)' : 'Hedefin Altına Düşünce (≤)'}
                          >
                            {isAbove ? '≥' : '≤'}
                          </div>
                        </td>

                        {/* Varlık */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-white font-mono text-sm">{a.symbol}</span>
                            <span className="text-[11px] text-slate-400">{a.name}</span>
                          </div>
                        </td>

                        {/* Tür */}
                        <td className="py-3 px-4">
                          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px] font-medium">
                            {ASSET_TYPE_NAMES[a.assetType] || 'Diğer'}
                          </span>
                        </td>

                        {/* Hedef Fiyat */}
                        <td className="py-3 px-4 text-right">
                          <span className="font-bold text-white font-mono text-sm">
                            {a.targetPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {curSym}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {isAbove ? '≥ seviyesinde' : '≤ seviyesinde'}
                          </span>
                        </td>

                        {/* Not */}
                        <td className="py-3 px-4">
                          {a.note ? (
                            <span className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md inline-block">
                              {a.note}
                            </span>
                          ) : (
                            <span className="text-slate-600 italic text-[11px]">-</span>
                          )}
                        </td>

                        {/* Durum / Zaman */}
                        <td className="py-3 px-4">
                          {a.isTriggered ? (
                            <div>
                              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                                Tetiklendi
                              </span>
                              {a.triggeredAt && (
                                <span className="text-[10px] text-slate-500 block mt-1">
                                  {new Date(a.triggeredAt).toLocaleString('tr-TR')}
                                  {a.triggeredPrice && (
                                    <> @ {a.triggeredPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {curSym}</>
                                  )}
                                </span>
                              )}
                            </div>
                          ) : a.isActive ? (
                            <div>
                              <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Canlı İzleniyor
                              </span>
                              <span className="text-[10px] text-slate-500 block mt-1">
                                Kurulma: {new Date(a.createdAt).toLocaleDateString('tr-TR')}
                              </span>
                            </div>
                          ) : (
                            <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Pasif
                            </span>
                          )}
                        </td>

                        {/* Aksiyonlar */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Tetiklendiyse Yeniden Aktifleştir Butonu */}
                            {a.isTriggered && (
                              <button
                                onClick={() => handleReactivate(a)}
                                className="p-1.5 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-500/10 rounded-lg transition cursor-pointer"
                                title="Alarmı Tekrar Aktifleştir"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Aktif / Pasif Toggle Switch */}
                            <button
                              onClick={() => handleToggle(a.id)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                                a.isActive
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                  : 'bg-slate-800 text-slate-400 hover:text-white'
                              }`}
                              title={a.isActive ? 'Alarmı Pasife Al' : 'Alarmı Aktifleştir'}
                            >
                              {a.isActive ? 'Aktif' : 'Pasif'}
                            </button>

                            {/* Sil Butonu */}
                            <button
                              onClick={() => handleDelete(a)}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                              title="Alarmı Sil"
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
      </div>

      {/* Onay Modalı */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export default function PriceAlertsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px] text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          <span>Fiyat Alarmları yükleniyor...</span>
        </div>
      }
    >
      <PriceAlertsContent />
    </Suspense>
  );
}
