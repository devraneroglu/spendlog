'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { api, SCRAPER_BASE_URL } from '@/lib/axios';
import axios from 'axios';
import { PortfolioItem, PortfolioSummary, PortfolioDistribution, PortfolioSnapshot, PriceAlert, PriceAlertCondition } from '@/types/portfolio';
import { AssetType, Currency } from '@/types/finance';
import { useAuthStore } from '@/store/auth-store';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { lttbDownsample } from '@/lib/lttb';
import { formatLocalDateToInput, toSafeApiDateString, formatShortDateTime } from '@/lib/date-utils';
import {
  TrendingUp,
  ArrowDownRight,
  Briefcase,
  Plus,
  DollarSign,
  PieChart as PieIcon,
  Calculator,
  Loader2,
  Trash2,
  Edit2,
  Tag,
  CheckCircle2,
  X,
  Check,
  Search,
  Layers,
  History,
  Settings2,
  Building2,
  ChevronDown,
  RefreshCw,
  Clock,
  Target,
  RotateCcw,
  Sparkles,
  Calendar,
  Bell,
  BellRing,
  BellOff,
  Radio,
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  AlertTriangle,
  FileUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

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

const CURRENCY_LABELS: Record<Currency, string> = {
  [Currency.TRY]: 'TRY',
  [Currency.USD]: 'USD',
  [Currency.EUR]: 'EUR',
  [Currency.GBP]: 'GBP',
  [Currency.BTC]: 'BTC',
  [Currency.ETH]: 'ETH',
};

interface PortfolioColumnConfig {
  id: string;
  label: string;
  defaultVisible: boolean;
}

const PORTFOLIO_COLUMNS: PortfolioColumnConfig[] = [
  { id: 'symbol', label: 'Sembol & Adı', defaultVisible: true },
  { id: 'assetType', label: 'Varlık Türü', defaultVisible: true },
  { id: 'platform', label: 'Platform', defaultVisible: true },
  { id: 'purchaseDate', label: 'Tarih', defaultVisible: true },
  { id: 'holdingPeriod', label: 'Elde Tutma Süresi', defaultVisible: true },
  { id: 'quantity', label: 'Miktar', defaultVisible: true },
  { id: 'purchasePrice', label: 'Alış Fiyatı', defaultVisible: true },
  { id: 'cost', label: 'Maliyet', defaultVisible: true },
  { id: 'currentPrice', label: 'Güncel / Satış Fiyatı', defaultVisible: true },
  { id: 'totalValue', label: 'Toplam Değer / Satış Tutarı', defaultVisible: true },
  { id: 'profitLoss', label: 'Kâr / Zarar', defaultVisible: true },
  { id: 'actions', label: 'İşlemler', defaultVisible: true },
];

const DEFAULT_VISIBLE_COLUMNS: Record<string, boolean> = {
  symbol: true,
  assetType: true,
  platform: true,
  purchaseDate: true,
  holdingPeriod: true,
  quantity: true,
  purchasePrice: true,
  cost: true,
  currentPrice: true,
  totalValue: true,
  profitLoss: true,
  actions: true,
};

const CustomDonutTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-950/95 border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs min-w-[200px] max-w-[260px] backdrop-blur-md z-50 pointer-events-none">
        <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-800">
          <span className="w-3 h-3 rounded-full shrink-0 shadow" style={{ backgroundColor: data.color }} />
          <span className="font-bold text-white text-xs truncate">{data.label}</span>
          <span className="ml-auto font-bold text-indigo-400">%{data.percentage.toFixed(1)}</span>
        </div>
        <div className="text-slate-200 font-mono font-bold text-xs mb-2">
          {Number(data.value).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
        </div>
        {data.subItems && data.subItems.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">İçerilen Varlıklar:</span>
            <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {data.subItems.map((s: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800/60">
                  <span className="font-bold text-slate-200">{s.symbol}</span>
                  <span className="text-slate-400 font-mono">{Number(s.value).toLocaleString('tr-TR', { minimumFractionDigits: 0 })} ₺</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

interface PredefinedAsset {
  symbol: string;
  name: string;
  assetType: AssetType;
  defaultCurrency: Currency;
}

const DEFAULT_PREDEFINED_ASSETS: PredefinedAsset[] = [
  { symbol: 'THYAO', name: 'Türk Hava Yolları', assetType: AssetType.Stock, defaultCurrency: Currency.TRY },
  { symbol: 'GARAN', name: 'Garanti Bankası', assetType: AssetType.Stock, defaultCurrency: Currency.TRY },
  { symbol: 'ASELS', name: 'Aselsan', assetType: AssetType.Stock, defaultCurrency: Currency.TRY },
  { symbol: 'KCHOL', name: 'Koç Holding', assetType: AssetType.Stock, defaultCurrency: Currency.TRY },
  { symbol: 'EREGL', name: 'Ereğli Demir Çelik', assetType: AssetType.Stock, defaultCurrency: Currency.TRY },
  { symbol: 'SISE', name: 'Şişecam', assetType: AssetType.Stock, defaultCurrency: Currency.TRY },
  { symbol: 'BIMAS', name: 'BİM Mağazalar', assetType: AssetType.Stock, defaultCurrency: Currency.TRY },
  { symbol: 'TUPRS', name: 'Tüpraş', assetType: AssetType.Stock, defaultCurrency: Currency.TRY },
  { symbol: 'BTC', name: 'Bitcoin', assetType: AssetType.Crypto, defaultCurrency: Currency.USD },
  { symbol: 'ETH', name: 'Ethereum', assetType: AssetType.Crypto, defaultCurrency: Currency.USD },
  { symbol: 'SOL', name: 'Solana', assetType: AssetType.Crypto, defaultCurrency: Currency.USD },
  { symbol: 'AVAX', name: 'Avalanche', assetType: AssetType.Crypto, defaultCurrency: Currency.USD },
  { symbol: 'ALTIN', name: 'Gram Altın', assetType: AssetType.Commodity, defaultCurrency: Currency.TRY },
  { symbol: 'CEYREK', name: 'Çeyrek Altın', assetType: AssetType.Commodity, defaultCurrency: Currency.TRY },
  { symbol: 'GUMUS', name: 'Gram Gümüş', assetType: AssetType.Commodity, defaultCurrency: Currency.TRY },
  { symbol: 'XAUUSD', name: 'Ons Altın', assetType: AssetType.Commodity, defaultCurrency: Currency.USD },
  { symbol: 'AAPL', name: 'Apple Inc.', assetType: AssetType.Stock, defaultCurrency: Currency.USD },
  { symbol: 'NVDA', name: 'Nvidia Corp.', assetType: AssetType.Stock, defaultCurrency: Currency.USD },
  { symbol: 'MSFT', name: 'Microsoft Corp.', assetType: AssetType.Stock, defaultCurrency: Currency.USD },
  { symbol: 'AMZN', name: 'Amazon.com', assetType: AssetType.Stock, defaultCurrency: Currency.USD },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', assetType: AssetType.ETF, defaultCurrency: Currency.USD },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', assetType: AssetType.ETF, defaultCurrency: Currency.USD },
];

const DEFAULT_PLATFORMS = [
  'Midas',
  'Midas Kripto',
  'Fiziki Kasa',
  'Yapı Kredi',
  'Ziraat Yatırım',
];

const TIMEFRAMES = ['1G', '1H', '1A', '3A', '1Y', 'TÜMÜ'];

export default function PortfolioPage() {
  const isValuesHidden = useAuthStore((state) => state.isValuesHidden);
  const toast = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'SOLD' | 'DISTRIBUTION' | 'SIMULATOR' | 'HISTORY'>('ACTIVE');

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

  const user = useAuthStore((state) => state.user);

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [distribution, setDistribution] = useState<PortfolioDistribution | null>(null);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [currencyMode, setCurrencyMode] = useState<'TRY' | 'USD'>('TRY');
  const [usdRate, setUsdRate] = useState<number>(45.00);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1A');
  const [isLoading, setIsLoading] = useState(true);

  // Custom User Definitions (Saved in localStorage scoped by user)
  const [customAssets, setCustomAssets] = useState<PredefinedAsset[]>([]);
  const [customPlatforms, setCustomPlatforms] = useState<string[]>([]);
  const [isDefinitionManagerOpen, setIsDefinitionManagerOpen] = useState(false);

  // New Definition Form State
  const [newDefSymbol, setNewDefSymbol] = useState('');
  const [newDefName, setNewDefName] = useState('');
  const [newDefType, setNewDefType] = useState<AssetType>(AssetType.Stock);
  const [newDefCurrency, setNewDefCurrency] = useState<Currency>(Currency.TRY);
  const [newDefPlatform, setNewDefPlatform] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAssetType, setFilterAssetType] = useState<string>('');
  const [filterPlatform, setFilterPlatform] = useState<string>('');

  // Column Visibility Management State
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(DEFAULT_VISIBLE_COLUMNS);
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('spendlog_portfolio_columns_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) {
          setVisibleColumns((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch (_) {}
  }, []);

  const toggleColumn = (colId: string) => {
    setVisibleColumns((prev) => {
      const updated = { ...prev, [colId]: !prev[colId] };
      try {
        localStorage.setItem('spendlog_portfolio_columns_v2', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const resetColumns = () => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    try {
      localStorage.setItem('spendlog_portfolio_columns_v2', JSON.stringify(DEFAULT_VISIBLE_COLUMNS));
    } catch (_) {}
  };

  const selectAllColumns = () => {
    const all: Record<string, boolean> = {};
    PORTFOLIO_COLUMNS.forEach((c) => { all[c.id] = true; });
    setVisibleColumns(all);
    try {
      localStorage.setItem('spendlog_portfolio_columns_v2', JSON.stringify(all));
    } catch (_) {}
  };

  // Simulation Mode State
  const [simulationPercent, setSimulationPercent] = useState<number>(10);
  const [symbolSimulations, setSymbolSimulations] = useState<Record<string, { percentChange: number; targetPrice: number }>>({});

  const handleUpdateSymbolSimulationPercent = (sym: string, curPrice: number, percentStr: string) => {
    const pct = parseFloat(percentStr) || 0;
    const targetPrice = curPrice * (1 + pct / 100);
    setSymbolSimulations((prev) => ({
      ...prev,
      [sym]: { percentChange: pct, targetPrice },
    }));
  };

  const handleUpdateSymbolSimulationPrice = (sym: string, curPrice: number, priceStr: string) => {
    const targetPrice = parseFloat(priceStr) || 0;
    const pct = curPrice > 0 ? ((targetPrice - curPrice) / curPrice) * 100 : 0;
    setSymbolSimulations((prev) => ({
      ...prev,
      [sym]: { percentChange: pct, targetPrice },
    }));
  };

  const handleResetSymbolSimulations = () => {
    setSymbolSimulations({});
    setSimulationPercent(10);
  };

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>(AssetType.Stock);
  const [currency, setCurrency] = useState<Currency>(Currency.TRY);
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseCommission, setPurchaseCommission] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [platform, setPlatform] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(formatLocalDateToInput());
  const [isSaving, setIsSaving] = useState(false);

  // Sell Modal State
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [sellingItem, setSellingItem] = useState<PortfolioItem | null>(null);
  const [salePrice, setSalePrice] = useState('');
  const [saleCommission, setSaleCommission] = useState('');
  const [saleDate, setSaleDate] = useState(formatLocalDateToInput());
  const [saleNote, setSaleNote] = useState('');
  const [isSelling, setIsSelling] = useState(false);
  const [isSyncingPrices, setIsSyncingPrices] = useState(false);
  const [lastPortfolioSyncTime, setLastPortfolioSyncTime] = useState<string>('');

  // Price Alerts State (Badge count)
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportIncludeSold, setExportIncludeSold] = useState(true);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [isExecutingImport, setIsExecutingImport] = useState(false);
  const [parsedImportRows, setParsedImportRows] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState<{ total: number; valid: number; invalid: number; active: number; sold: number }>({
    total: 0,
    valid: 0,
    invalid: 0,
    active: 0,
    sold: 0,
  });

  // Load Custom Definitions from LocalStorage on mount or when user changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const assetsKey = user?.id ? `spendlog_${user.id}_custom_assets` : 'spendlog_custom_assets';
      let savedAssets = localStorage.getItem(assetsKey);
      if (!savedAssets && user?.id) {
        // Fallback to legacy key for existing data
        savedAssets = localStorage.getItem('spendlog_custom_assets');
      }

      if (savedAssets) {
        setCustomAssets(JSON.parse(savedAssets));
      } else {
        setCustomAssets(DEFAULT_PREDEFINED_ASSETS);
      }

      const platformsKey = user?.id ? `spendlog_${user.id}_custom_platforms_v2` : 'spendlog_custom_platforms_v2';
      let savedPlatforms = localStorage.getItem(platformsKey);
      if (!savedPlatforms && user?.id) {
        // Fallback to legacy key for existing data
        savedPlatforms = localStorage.getItem('spendlog_custom_platforms_v2');
      }

      if (savedPlatforms) {
        try {
          const parsed = JSON.parse(savedPlatforms);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCustomPlatforms(parsed);
          } else {
            setCustomPlatforms(DEFAULT_PLATFORMS);
          }
        } catch {
          setCustomPlatforms(DEFAULT_PLATFORMS);
        }
      } else {
        setCustomPlatforms(DEFAULT_PLATFORMS);
        localStorage.setItem(platformsKey, JSON.stringify(DEFAULT_PLATFORMS));
        try {
          localStorage.removeItem('spendlog_custom_platforms');
        } catch (_) {}
      }
    } catch (e) {
      setCustomAssets(DEFAULT_PREDEFINED_ASSETS);
      setCustomPlatforms(DEFAULT_PLATFORMS);
    }
  }, [user?.id]);

  const saveAssetsToStorage = (assets: PredefinedAsset[]) => {
    setCustomAssets(assets);
    if (typeof window !== 'undefined') {
      const assetsKey = user?.id ? `spendlog_${user.id}_custom_assets` : 'spendlog_custom_assets';
      localStorage.setItem(assetsKey, JSON.stringify(assets));
    }
  };

  const savePlatformsToStorage = (platforms: string[]) => {
    setCustomPlatforms(platforms);
    if (typeof window !== 'undefined') {
      const platformsKey = user?.id ? `spendlog_${user.id}_custom_platforms_v2` : 'spendlog_custom_platforms_v2';
      localStorage.setItem(platformsKey, JSON.stringify(platforms));
    }
  };

  const handleAddCustomAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDefSymbol.trim()) return;

    const newAsset: PredefinedAsset = {
      symbol: newDefSymbol.trim().toUpperCase(),
      name: newDefName.trim() || newDefSymbol.trim().toUpperCase(),
      assetType: newDefType,
      defaultCurrency: newDefCurrency,
    };

    const updated = [newAsset, ...customAssets.filter((a) => a.symbol !== newAsset.symbol)];
    saveAssetsToStorage(updated);
    setNewDefSymbol('');
    setNewDefName('');
  };

  const handleDeleteCustomAsset = (sym: string) => {
    const updated = customAssets.filter((a) => a.symbol !== sym);
    saveAssetsToStorage(updated);
  };

  const handleAddCustomPlatform = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDefPlatform.trim()) return;

    const name = newDefPlatform.trim();
    if (!customPlatforms.includes(name)) {
      const updated = [...customPlatforms, name];
      savePlatformsToStorage(updated);
    }
    setNewDefPlatform('');
  };

  const handleDeleteCustomPlatform = (plat: string) => {
    const updated = customPlatforms.filter((p) => p !== plat);
    savePlatformsToStorage(updated);
  };

  const fetchPortfolioData = async (customRate?: number) => {
    const rate = customRate ?? usdRate;
    try {
      setIsLoading(true);
      const [itemsRes, summaryRes, distRes, snapRes] = await Promise.allSettled([
        api.get<PortfolioItem[]>('/api/portfolio'),
        api.get<PortfolioSummary>(`/api/portfolio/summary?usdRate=${rate}`),
        api.get<PortfolioDistribution>(`/api/portfolio/distribution?usdRate=${rate}`),
        api.get<PortfolioSnapshot[]>('/api/portfolio/snapshots'),
      ]);

      if (itemsRes.status === 'fulfilled' && itemsRes.value.data) {
        setItems(itemsRes.value.data);
      }
      if (summaryRes.status === 'fulfilled' && summaryRes.value.data) {
        setSummary(summaryRes.value.data);
      }
      if (distRes.status === 'fulfilled' && distRes.value.data) {
        setDistribution(distRes.value.data);
      }
      if (snapRes.status === 'fulfilled' && snapRes.value.data) {
        setSnapshots(snapRes.value.data);
        if (snapRes.value.data.length > 0 && snapRes.value.data[0].snapshotDate) {
          setLastPortfolioSyncTime((prev) => prev || formatShortDateTime(snapRes.value.data[0].snapshotDate));
        }
      }
      await fetchAlerts();
    } catch (err: any) {
      console.warn('Portföy verileri alınırken uyarı:', err?.message || err);
    } finally {
      setIsLoading(false);
    }
  };

  // Alış veya işlem tarihindeki USD/TL kurunu snapshots veya geçmiş verilerden dinamik getirelim
  const getUsdRateForDate = (dateStr?: string | null): number => {
    if (!dateStr) return summary?.usdToTryRate || usdRate || 45.00;
    const targetTime = new Date(dateStr).getTime();

    if (snapshots && snapshots.length > 0) {
      let closestSnap = snapshots[0];
      let minDiff = Math.abs(new Date(closestSnap.snapshotDate).getTime() - targetTime);

      for (const snap of snapshots) {
        if (snap.exchangeRate && snap.exchangeRate > 0) {
          const diff = Math.abs(new Date(snap.snapshotDate).getTime() - targetTime);
          if (diff < minDiff) {
            minDiff = diff;
            closestSnap = snap;
          }
        }
      }

      if (closestSnap && closestSnap.exchangeRate > 0) {
        return closestSnap.exchangeRate;
      }
    }

    return summary?.usdToTryRate || usdRate || 45.00;
  };

  const fetchAlerts = async () => {
    try {
      const res = await api.get<PriceAlert[]>('/api/pricealerts');
      setAlerts(res.data || []);
    } catch (err: any) {
      console.warn('Alarmlar yüklenirken uyarı:', err?.message || err);
    }
  };

  const handleDeleteSnapshotPrompt = (snap: PortfolioSnapshot) => {
    const dateFormatted = new Date(snap.snapshotDate).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    setConfirmModalState({
      isOpen: true,
      title: 'Portföy Snapshot Kaydını Sil',
      message: `${dateFormatted} tarihli (${snap.totalValueTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺) portföy geçmiş kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      onConfirm: async () => {
        try {
          await api.delete(`/api/portfolio/snapshots/${snap.id}`);
          setSnapshots((prev) => prev.filter((s) => s.id !== snap.id));
          toast.success('Portföy geçmiş kaydı başarıyla silindi.');
        } catch (err) {
          toast.error('Geçmiş kaydı silinirken hata oluştu.');
        } finally {
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleClearAllSnapshotsPrompt = () => {
    setConfirmModalState({
      isOpen: true,
      title: 'Tüm Portföy Geçmişini Temizle',
      message: `Toplam ${snapshots.length} adet geçmiş portföy snapshot kaydının tamamını silmek istediğinize emin misiniz? Bu işlem geçmiş büyüme grafiğinizi sıfırlayacaktır ve geri alınamaz.`,
      onConfirm: async () => {
        try {
          const res = await api.delete('/api/portfolio/snapshots/clear-all');
          setSnapshots([]);
          toast.success(`${res.data?.deletedCount || 0} adet geçmiş snapshot kaydı temizlendi.`);
        } catch (err) {
          toast.error('Geçmiş kayıtları temizlenirken hata oluştu.');
        } finally {
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleSyncLivePrices = async () => {
    setIsSyncingPrices(true);
    toast.info('Canlı piyasa önbelleği taranıyor ve portföy güncelleniyor...');

    try {
      const activeItems = items.filter((i) => i.isActive);
      const uniqueSymbols = Array.from(new Set(activeItems.map((i) => i.symbol.toUpperCase().trim())));
      let priceUpdates: Array<{ symbol: string; price: number }> = [];
      let currentUsdRate = usdRate > 0 ? usdRate : 48.64;

      // 1. Hızlı Toplu Önbellek Çağrısı (POST /api/prices/portfolio-lookup)
      try {
        const lookupRes = await axios.post(
          `${SCRAPER_BASE_URL}/api/prices/portfolio-lookup`,
          { symbols: uniqueSymbols, include_usd_rate: true },
          { timeout: 8000 }
        );

        if (lookupRes.status === 200 && lookupRes.data) {
          if (lookupRes.data.usdRate && lookupRes.data.usdRate > 0) {
            currentUsdRate = lookupRes.data.usdRate;
            setUsdRate(currentUsdRate);
          }

          if (Array.isArray(lookupRes.data.prices)) {
            priceUpdates = lookupRes.data.prices
              .filter((p: any) => p.price !== null && p.price !== undefined && p.price > 0)
              .map((p: any) => ({
                symbol: p.symbol,
                price: Number(p.price),
              }));
          }
        }
      } catch (lookupErr) {
        console.warn('Portfolio lookup direct call fallback; backend resolver will handle it...', lookupErr);
      }

      // 2. UI State'i Anında Canlı Fiyatlarla Güncelle (Optimistic UI - 0 ms)
      if (priceUpdates.length > 0) {
        const updateMap = new Map(priceUpdates.map((p) => [p.symbol.toUpperCase().trim(), p.price]));
        const normalizeSym = (s: string) => s.toUpperCase().replace(/[\s\-_.]/g, '').replace(/(\/TL|\/TRY|\.IS|\.E)$/, '');
        const normMap = new Map(priceUpdates.map((p) => [normalizeSym(p.symbol), p.price]));

        setItems((prev) =>
          prev.map((it) => {
            const clean = it.symbol.toUpperCase().trim();
            const norm = normalizeSym(it.symbol);
            const matchedPrice = updateMap.get(clean) ?? normMap.get(norm);

            if (matchedPrice && matchedPrice > 0) {
              const newCost = it.cost;
              const newVal = it.quantity * matchedPrice;
              const newProfitLoss = newVal - newCost;
              const newProfitLossPercent = newCost > 0 ? (newProfitLoss / newCost) * 100 : 0;
              return {
                ...it,
                currentPrice: matchedPrice,
                currentValue: newVal,
                profitLoss: newProfitLoss,
                profitLossPercent: newProfitLossPercent,
              };
            }
            return it;
          })
        );
      }

      // 3. Backend'e göndererek CurrentPrice ve PortfolioSnapshots'ı veritabanına işle (Backend kendisi de eksikleri tamamlar)
      const res = await api.post('/api/portfolio/batch-update-prices', {
        prices: priceUpdates,
        usdToTryRate: currentUsdRate,
      });

      // 4. Backend'den dönen güncel items, summary ve exchange rate verisini doğrudan state'e set et
      if (res.data?.success) {
        if (res.data.items && Array.isArray(res.data.items)) {
          setItems(res.data.items);
        }
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
        if (res.data.usdToTryRate && res.data.usdToTryRate > 0) {
          setUsdRate(res.data.usdToTryRate);
        }
      } else {
        // Fallback: Eski usul fetch
        await fetchPortfolioData(currentUsdRate);
      }

      // 5. Dağılım ve Snapshots geçmişini de tazeleyelim
      const [distRes, snapRes] = await Promise.allSettled([
        api.get<PortfolioDistribution>(`/api/portfolio/distribution?usdRate=${currentUsdRate}`),
        api.get<PortfolioSnapshot[]>('/api/portfolio/snapshots'),
      ]);
      if (distRes.status === 'fulfilled' && distRes.value.data) {
        setDistribution(distRes.value.data);
      }
      if (snapRes.status === 'fulfilled' && snapRes.value.data) {
        setSnapshots(snapRes.value.data);
      }

      const updatedCount = res.data?.updatedCount ?? priceUpdates.length;
      const syncStr = formatShortDateTime();
      setLastPortfolioSyncTime(syncStr);
      if (typeof window !== 'undefined') {
        localStorage.setItem('spendlog_portfolio_sync_time', syncStr);
      }
      toast.success(`Portföy başarıyla güncellendi! (${updatedCount} varlık güncel fiyata çekildi)`);
    } catch (err) {
      console.error('Failed to sync portfolio live prices', err);
      toast.error('Portföy güncellenirken bir hata oluştu.');
    } finally {
      setIsSyncingPrices(false);
    }
  };

  useEffect(() => {
    let liveRate = 45.00;
    if (typeof window !== 'undefined') {
      const savedSync = localStorage.getItem('spendlog_portfolio_sync_time');
      if (savedSync) {
        setLastPortfolioSyncTime(savedSync);
      }

      const cached = localStorage.getItem('spendlog_market_cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.rates?.USD && parsed.rates.USD > 0) {
            liveRate = parsed.rates.USD;
          }
        } catch (e) {}
      }
    }
    setUsdRate(liveRate);

    // 1. Önce HİÇ BEKLEMEDEN mevcut kur ile portföyü anında yükle! (0 gecikme)
    fetchPortfolioData(liveRate);

    // 2. Ardından arka planda sessizce canlı kuru güncelle
    axios.get(`${SCRAPER_BASE_URL}/api/prices/currency?base=USD&target=TRY`, { timeout: 2000 })
      .then((usdRes) => {
        if (usdRes.data?.rate && usdRes.data.rate > 0 && Math.abs(usdRes.data.rate - liveRate) > 0.05) {
          setUsdRate(usdRes.data.rate);
          fetchPortfolioData(usdRes.data.rate);
        }
      })
      .catch(() => {});
  }, []);

  // When user selects a predefined asset in the modal
  const handleSelectPredefinedAsset = (selectedSymbol: string) => {
    if (!selectedSymbol) return;
    const found = customAssets.find((a) => a.symbol === selectedSymbol);
    if (found) {
      setSymbol(found.symbol);
      setName(found.name);
      setAssetType(found.assetType);
      setCurrency(found.defaultCurrency);
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setSymbol('');
    setName('');
    setAssetType(AssetType.Stock);
    setCurrency(Currency.TRY);
    setQuantity('');
    setPurchasePrice('');
    setPurchaseCommission('');
    setCurrentPrice('');
    setPlatform(customPlatforms[0] || 'Midas');
    setTargetPrice('');
    setPurchaseDate(formatLocalDateToInput());
    setIsModalOpen(true);
  };

  const openEditModal = (it: PortfolioItem) => {
    setEditingItem(it);
    setSymbol(it.symbol);
    setName(it.name);
    setAssetType(it.assetType);
    setCurrency(it.currency);
    setQuantity(it.quantity.toString());
    setPurchasePrice(it.purchasePrice.toString());
    setPurchaseCommission(it.purchaseCommission ? it.purchaseCommission.toString() : '');
    setCurrentPrice(it.currentPrice.toString());
    setPlatform(it.platform || customPlatforms[0] || '');
    setTargetPrice(it.targetPrice ? it.targetPrice.toString() : '');
    setPurchaseDate(it.purchaseDate ? formatLocalDateToInput(new Date(it.purchaseDate)) : formatLocalDateToInput());
    setIsModalOpen(true);
  };

  const openSellModal = (it: PortfolioItem) => {
    setSellingItem(it);
    setSalePrice(it.currentPrice > 0 ? it.currentPrice.toString() : it.purchasePrice.toString());
    setSaleCommission('');
    setSaleDate(formatLocalDateToInput());
    setSaleNote('Kısmi/Tam Satış Gerçekleşti');
    setIsSellModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const formattedPurchaseDate = toSafeApiDateString(purchaseDate);

      if (editingItem) {
        await api.put(`/api/portfolio/${editingItem.id}`, {
          id: editingItem.id,
          symbol,
          name: name || symbol,
          assetType,
          currency,
          quantity: parseFloat(quantity) || 0,
          purchasePrice: parseFloat(purchasePrice) || 0,
          currentPrice: parseFloat(currentPrice) || parseFloat(purchasePrice) || 0,
          purchaseCommission: parseFloat(purchaseCommission) || 0,
          purchaseDate: formattedPurchaseDate,
          platform,
          notes: editingItem.notes,
          targetPrice: targetPrice ? parseFloat(targetPrice) : null,
        });
        toast.success(`"${symbol}" varlığı başarıyla güncellendi.`);
      } else {
        await api.post('/api/portfolio', {
          symbol,
          name: name || symbol,
          assetType,
          currency,
          quantity: parseFloat(quantity) || 0,
          purchasePrice: parseFloat(purchasePrice) || 0,
          currentPrice: parseFloat(purchasePrice) || 0,
          purchaseCommission: parseFloat(purchaseCommission) || 0,
          purchaseDate: formattedPurchaseDate,
          platform,
          targetPrice: targetPrice ? parseFloat(targetPrice) : null,
        });
        toast.success(`"${symbol}" varlığı portföye eklendi.`);
      }
      setIsModalOpen(false);
      await fetchPortfolioData();
    } catch (err: any) {
      console.error('Failed to save portfolio item', err);
      toast.error('Varlık kaydedilirken hata oluştu: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSellItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellingItem) return;

    setIsSelling(true);
    try {
      await api.post(`/api/portfolio/${sellingItem.id}/sell`, {
        id: sellingItem.id,
        salePrice: parseFloat(salePrice) || 0,
        saleDate: new Date(saleDate).toISOString(),
        saleCommission: parseFloat(saleCommission) || 0,
        notes: saleNote,
      });
      setIsSellModalOpen(false);
      await fetchPortfolioData();
      toast.success(`"${sellingItem.symbol}" satışı başarıyla kaydedildi.`);
    } catch (err: any) {
      console.error('Failed to sell portfolio item', err);
      toast.error('Satış işlemi kaydedilirken hata oluştu: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSelling(false);
    }
  };

  const handleUndoSale = (it: PortfolioItem) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Satışı Geri Al',
      message: `"${it.symbol}" varlığının satış işlemini geri alıp, tekrar aktif portföye aktarmak istediğinize emin misiniz?`,
      onConfirm: async () => {
        try {
          await api.post(`/api/portfolio/${it.id}/undo-sale`);
          toast.success(`"${it.symbol}" satışı geri alındı ve aktif portföye aktarıldı.`);
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          await fetchPortfolioData();
        } catch (err: any) {
          console.error('Failed to undo portfolio sale', err);
          toast.error('Satış geri alınırken hata oluştu: ' + (err.response?.data?.detail || err.message));
        }
      },
    });
  };

  const handleDeleteItem = (id: number, symbol: string) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Varlığı Sil',
      message: `"${symbol}" varlığını portföyünüzden silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      onConfirm: async () => {
        try {
          await api.delete(`/api/portfolio/${id}`);
          toast.success(`"${symbol}" varlığı portföyden silindi.`);
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          fetchPortfolioData();
        } catch (err: any) {
          console.error('Failed to delete portfolio item', err);
          toast.error('Varlık silinirken hata oluştu: ' + (err.response?.data?.detail || err.message));
        }
      },
    });
  };

  // 1. Örnek Excel Şablonu İndir
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          'Sembol': 'THYAO',
          'Varlık Adı': 'Türk Hava Yolları',
          'Tür': 'Hisse Senedi',
          'Para Birimi': 'TRY',
          'Miktar': 100,
          'Alış Fiyatı': 310.50,
          'Alış Tarihi': '2026-01-15',
          'Kurum / Platform': 'Garanti BBVA',
          'Notlar': 'Temettü hedefli birikim',
          'Satıldı mı': 'Hayır',
          'Satış Fiyatı': '',
          'Satış Tarihi': '',
        },
        {
          'Sembol': 'BTC',
          'Varlık Adı': 'Bitcoin',
          'Tür': 'Kripto Para',
          'Para Birimi': 'USD',
          'Miktar': 0.05,
          'Alış Fiyatı': 65000,
          'Alış Tarihi': '2026-02-10',
          'Kurum / Platform': 'Binance',
          'Notlar': 'DCA birikim',
          'Satıldı mı': 'Hayır',
          'Satış Fiyatı': '',
          'Satış Tarihi': '',
        },
        {
          'Sembol': 'ALTIN',
          'Varlık Adı': 'Gram Altın',
          'Tür': 'Altın & Emtia',
          'Para Birimi': 'TRY',
          'Miktar': 25,
          'Alış Fiyatı': 2950,
          'Alış Tarihi': '2026-03-01',
          'Kurum / Platform': 'Fiziki Kasa',
          'Notlar': 'Güvenli liman',
          'Satıldı mı': 'Hayır',
          'Satış Fiyatı': '',
          'Satış Tarihi': '',
        },
        {
          'Sembol': 'EREGL',
          'Varlık Adı': 'Ereğli Demir Çelik',
          'Tür': 'Hisse Senedi',
          'Para Birimi': 'TRY',
          'Miktar': 500,
          'Alış Fiyatı': 42.00,
          'Alış Tarihi': '2025-11-10',
          'Kurum / Platform': 'Midas',
          'Notlar': 'Kâr satışı yapıldı',
          'Satıldı mı': 'Evet',
          'Satış Fiyatı': 48.50,
          'Satış Tarihi': '2026-02-20',
        },
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Portföy Şablonu');
      XLSX.writeFile(wb, 'SpendLog_Portfoy_Sablonu.xlsx');
      toast.success('Örnek şablon Excel dosyası başarıyla indirildi.');
    } catch (e: any) {
      toast.error('Şablon oluşturulamadı: ' + e.message);
    }
  };

  // 2. Dışa Aktar: Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const exportList = exportIncludeSold ? items : activeItems;
      if (exportList.length === 0) {
        toast.error('Dışa aktarılacak varlık bulunamadı.');
        return;
      }

      const rows = exportList.map((it) => ({
        'Durum': it.isActive ? 'Aktif' : 'Satıldı',
        'Sembol': it.symbol,
        'Varlık Adı': it.name,
        'Tür': ASSET_TYPE_NAMES[it.assetType] || 'Diğer',
        'Para Birimi': CURRENCY_LABELS[it.currency] || 'TRY',
        'Miktar': it.quantity,
        'Alış Fiyatı': it.purchasePrice,
        'Güncel Fiyat': it.currentPrice,
        'Toplam Maliyet': it.cost,
        'Güncel / Satış Değeri': it.currentValue,
        'Kâr / Zarar': it.profitLoss,
        'Getiri (%)': Number(it.profitLossPercent.toFixed(2)),
        'Kurum / Platform': it.platform || '',
        'Alış Tarihi': it.purchaseDate ? new Date(it.purchaseDate).toLocaleDateString('tr-TR') : '',
        'Satış Fiyatı': !it.isActive && it.salePrice ? it.salePrice : '',
        'Satış Tarihi': !it.isActive && it.saleDate ? new Date(it.saleDate).toLocaleDateString('tr-TR') : '',
        'Notlar': it.notes || '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Portföyüm');
      XLSX.writeFile(wb, `SpendLog_Portfoy_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`Portföy Excel olarak indirildi (${rows.length} kayıt).`);
      setIsExportModalOpen(false);
    } catch (e: any) {
      toast.error('Excel aktarımı sırasında hata: ' + e.message);
    }
  };

  // 3. Dışa Aktar: CSV (.csv)
  const handleExportCsv = () => {
    try {
      const exportList = exportIncludeSold ? items : activeItems;
      if (exportList.length === 0) {
        toast.error('Dışa aktarılacak varlık bulunamadı.');
        return;
      }

      const rows = exportList.map((it) => ({
        'Durum': it.isActive ? 'Aktif' : 'Satıldı',
        'Sembol': it.symbol,
        'Varlık Adı': it.name,
        'Tür': ASSET_TYPE_NAMES[it.assetType] || 'Diğer',
        'Para Birimi': CURRENCY_LABELS[it.currency] || 'TRY',
        'Miktar': it.quantity,
        'Alış Fiyatı': it.purchasePrice,
        'Güncel Fiyat': it.currentPrice,
        'Toplam Maliyet': it.cost,
        'Güncel / Satış Değeri': it.currentValue,
        'Kâr / Zarar': it.profitLoss,
        'Getiri (%)': Number(it.profitLossPercent.toFixed(2)),
        'Kurum / Platform': it.platform || '',
        'Alış Tarihi': it.purchaseDate ? new Date(it.purchaseDate).toLocaleDateString('tr-TR') : '',
        'Satış Fiyatı': !it.isActive && it.salePrice ? it.salePrice : '',
        'Satış Tarihi': !it.isActive && it.saleDate ? new Date(it.saleDate).toLocaleDateString('tr-TR') : '',
        'Notlar': it.notes || '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const csvContent = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SpendLog_Portfoy_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Portföy CSV olarak indirildi (${rows.length} kayıt).`);
      setIsExportModalOpen(false);
    } catch (e: any) {
      toast.error('CSV aktarımı sırasında hata: ' + e.message);
    }
  };

  // 4. Dışa Aktar: PDF / Yazdırılabilir Rapor
  const handleExportPdf = () => {
    try {
      const exportList = exportIncludeSold ? items : activeItems;
      if (exportList.length === 0) {
        toast.error('Dışa aktarılacak varlık bulunamadı.');
        return;
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Yazdırma penceresi açılamadı. Lütfen tarayıcıda açılır pencerelere izin verin.');
        return;
      }

      const rowsHtml = exportList.map((it, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
          <td style="padding: 6px 10px; font-weight: 700; font-family: monospace;">${it.symbol}</td>
          <td style="padding: 6px 10px;">${it.name}</td>
          <td style="padding: 6px 10px;">${ASSET_TYPE_NAMES[it.assetType] || 'Diğer'}</td>
          <td style="padding: 6px 10px; text-align: center;">${it.isActive ? '<span style="color: #059669; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">Aktif</span>' : '<span style="color: #7c3aed; font-weight: bold; background: #f5f3ff; padding: 2px 6px; border-radius: 4px;">Satıldı</span>'}</td>
          <td style="padding: 6px 10px; text-align: right; font-family: monospace;">${it.quantity.toLocaleString('tr-TR')}</td>
          <td style="padding: 6px 10px; text-align: right; font-family: monospace;">${it.purchasePrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${CURRENCY_SYMBOLS[it.currency]}</td>
          <td style="padding: 6px 10px; text-align: right; font-family: monospace;">${it.cost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${CURRENCY_SYMBOLS[it.currency]}</td>
          <td style="padding: 6px 10px; text-align: right; font-family: monospace; font-weight: 700;">${it.currentValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${CURRENCY_SYMBOLS[it.currency]}</td>
          <td style="padding: 6px 10px; text-align: right; font-family: monospace; font-weight: 700; color: ${it.profitLoss >= 0 ? '#059669' : '#dc2626'};">${it.profitLoss >= 0 ? '+' : ''}${it.profitLoss.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${CURRENCY_SYMBOLS[it.currency]} (%${it.profitLossPercent.toFixed(2)})</td>
          <td style="padding: 6px 10px; font-size: 11px; color: #475569;">${it.platform || '-'}</td>
        </tr>
      `).join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>SpendLog V2 - Konsolide Portföy Raporu</title>
            <meta charset="utf-8" />
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 24px; font-size: 11px; }
              .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 16px; }
              .title { font-size: 18px; font-weight: 800; color: #1e1b4b; margin: 0; }
              .meta { font-size: 10px; color: #64748b; margin-top: 4px; }
              .kpi-container { display: flex; gap: 12px; margin-bottom: 16px; }
              .kpi { flex: 1; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; }
              .kpi-title { font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; }
              .kpi-val { font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 4px; font-family: monospace; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th { background: #1e293b; color: #f8fafc; padding: 8px 10px; font-size: 10px; text-transform: uppercase; text-align: left; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <h1 class="title">SpendLog V2 — Konsolide Portföy Raporu</h1>
                <div class="meta">Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')} • Kapsam: ${exportIncludeSold ? 'Tüm Varlıklar (Aktif + Satılan)' : 'Sadece Aktif Varlıklar'}</div>
              </div>
              <div style="font-weight: 800; font-size: 14px; color: #6366f1;">SpendLog PRO v2.0</div>
            </div>
            <div class="kpi-container">
              <div class="kpi">
                <div class="kpi-title">Toplam Portföy Değeri</div>
                <div class="kpi-val">${effectiveSummary ? effectiveSummary.totalCurrentValueTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0'} ₺</div>
              </div>
              <div class="kpi">
                <div class="kpi-title">Toplam Maliyet</div>
                <div class="kpi-val">${effectiveSummary ? effectiveSummary.totalCostTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0'} ₺</div>
              </div>
              <div class="kpi">
                <div class="kpi-title">Kâr / Zarar</div>
                <div class="kpi-val" style="color: ${(effectiveSummary?.totalProfitLossTRY || 0) >= 0 ? '#059669' : '#dc2626'}">${(effectiveSummary?.totalProfitLossTRY || 0) >= 0 ? '+' : ''}${effectiveSummary?.totalProfitLossTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ (%${effectiveSummary?.totalProfitLossPercent.toFixed(2)})</div>
              </div>
              <div class="kpi">
                <div class="kpi-title">Varlık Sayısı</div>
                <div class="kpi-val">${exportList.length} Kalem</div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Sembol</th>
                  <th>Varlık Adı</th>
                  <th>Tür</th>
                  <th style="text-align: center;">Durum</th>
                  <th style="text-align: right;">Miktar</th>
                  <th style="text-align: right;">Alış Fiyatı</th>
                  <th style="text-align: right;">Maliyet</th>
                  <th style="text-align: right;">Güncel Değer</th>
                  <th style="text-align: right;">Kâr / Zarar</th>
                  <th>Platform</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
      toast.success('Yazdırılabilir PDF raporu hazırlandı.');
      setIsExportModalOpen(false);
    } catch (e: any) {
      toast.error('PDF oluşturulurken hata: ' + e.message);
    }
  };

  // 5. İçe Aktar: Excel Dosyasını Oku ve Ayrıştır
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setIsParsingImport(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          toast.error('Seçilen dosyada veri bulunamadı.');
          setIsParsingImport(false);
          return;
        }

        const parsedList: any[] = [];
        let validCount = 0;
        let invalidCount = 0;
        let activeCount = 0;
        let soldCount = 0;

        rawJson.forEach((row, index) => {
          const rowKeys = Object.keys(row);
          const findVal = (...aliases: string[]) => {
            for (const alias of aliases) {
              const k = rowKeys.find((key) => key.trim().toLowerCase() === alias.toLowerCase());
              if (k && row[k] !== undefined && row[k] !== '') return row[k];
            }
            return '';
          };

          const rawSymbol = String(findVal('sembol', 'symbol', 'kod', 'ticker')).trim();
          const rawName = String(findVal('varlık adı', 'varlik adi', 'ad', 'name', 'isim', 'varlık')).trim();
          const rawType = String(findVal('tür', 'tur', 'tip', 'assettype', 'kategori')).trim().toLowerCase();
          const rawCurrency = String(findVal('para birimi', 'para', 'currency', 'döviz', 'doviz')).trim().toLowerCase();
          const rawQty = findVal('miktar', 'adet', 'lot', 'quantity', 'qty');
          const rawBuyPrice = findVal('alış fiyatı', 'alis fiyati', 'maliyet', 'fiyat', 'price', 'purchaseprice');
          const rawBuyDate = findVal('alış tarihi', 'alis tarihi', 'tarih', 'date', 'purchasedate');
          const rawPlatform = String(findVal('kurum / platform', 'kurum', 'platform', 'banka', 'aracı')).trim();
          const rawNotes = String(findVal('notlar', 'not', 'açıklama', 'aciklama', 'notes')).trim();
          const rawSold = String(findVal('satıldı mı', 'satildi mi', 'satıldı', 'satildi', 'sold', 'durum')).trim().toLowerCase();
          const rawSalePrice = findVal('satış fiyatı', 'satis fiyati', 'saleprice');
          const rawSaleDate = findVal('satış tarihi', 'satis tarihi', 'saledate');

          // Determine AssetType
          let parsedAssetType = AssetType.Stock;
          if (rawType.includes('kripto') || rawType.includes('crypto') || rawType.includes('coin')) {
            parsedAssetType = AssetType.Crypto;
          } else if (rawType.includes('altın') || rawType.includes('altin') || rawType.includes('emtia') || rawType.includes('gümüş') || rawType.includes('gumus')) {
            parsedAssetType = AssetType.Commodity;
          } else if (rawType.includes('fon') || rawType.includes('etf') || rawType.includes('tefas')) {
            parsedAssetType = AssetType.ETF;
          } else if (rawType.includes('tahvil') || rawType.includes('bono') || rawType.includes('bond')) {
            parsedAssetType = AssetType.Bond;
          }

          // Determine Currency
          let parsedCurrency = Currency.TRY;
          if (rawCurrency.includes('usd') || rawCurrency.includes('dolar') || rawCurrency.includes('$')) {
            parsedCurrency = Currency.USD;
          } else if (rawCurrency.includes('eur') || rawCurrency.includes('euro') || rawCurrency.includes('€')) {
            parsedCurrency = Currency.EUR;
          } else if (rawCurrency.includes('gbp') || rawCurrency.includes('sterlin') || rawCurrency.includes('£')) {
            parsedCurrency = Currency.GBP;
          } else if (rawCurrency.includes('btc')) {
            parsedCurrency = Currency.BTC;
          } else if (rawCurrency.includes('eth')) {
            parsedCurrency = Currency.ETH;
          }

          // Numbers
          const cleanNumber = (val: any): number => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            const str = String(val).replace(/\s/g, '').replace(',', '.');
            const n = parseFloat(str);
            return isNaN(n) ? 0 : n;
          };

          const quantity = cleanNumber(rawQty);
          const purchasePrice = cleanNumber(rawBuyPrice);
          const currentPrice = purchasePrice;
          const isSold = ['evet', 'yes', 'true', '1', 'satıldı', 'satildi'].includes(rawSold);
          const salePrice = isSold ? cleanNumber(rawSalePrice) : null;

          // Dates
          let purchaseDate = new Date();
          if (rawBuyDate) {
            const d = new Date(rawBuyDate);
            if (!isNaN(d.getTime())) purchaseDate = d;
          }

          let saleDate: Date | null = null;
          if (isSold) {
            if (rawSaleDate) {
              const d = new Date(rawSaleDate);
              if (!isNaN(d.getTime())) saleDate = d;
            }
            if (!saleDate) saleDate = new Date();
          }

          // Validation
          const errors: string[] = [];
          if (!rawSymbol) errors.push('Sembol eksik');
          if (quantity <= 0) errors.push('Miktar 0\'dan büyük olmalı');
          if (purchasePrice < 0) errors.push('Alış fiyatı negatif olamaz');
          if (isSold && (!salePrice || salePrice <= 0)) errors.push('Satılan varlık için geçerli satış fiyatı girilmeli');

          const isValid = errors.length === 0;
          if (isValid) {
            validCount++;
            if (isSold) soldCount++;
            else activeCount++;
          } else {
            invalidCount++;
          }

          parsedList.push({
            rowNumber: index + 2,
            symbol: rawSymbol.toUpperCase(),
            name: rawName || rawSymbol.toUpperCase(),
            assetType: parsedAssetType,
            currency: parsedCurrency,
            quantity,
            purchasePrice,
            currentPrice,
            purchaseDate: purchaseDate.toISOString(),
            platform: rawPlatform || null,
            notes: rawNotes || null,
            isActive: !isSold,
            salePrice,
            saleDate: saleDate ? saleDate.toISOString() : null,
            isValid,
            errors,
          });
        });

        setParsedImportRows(parsedList);
        setImportSummary({
          total: rawJson.length,
          valid: validCount,
          invalid: invalidCount,
          active: activeCount,
          sold: soldCount,
        });
        toast.info(`${rawJson.length} satır okundu (${validCount} geçerli, ${invalidCount} hatalı).`);
      } catch (err: any) {
        console.error('File parsing error', err);
        toast.error('Excel dosyası okunamadı: ' + err.message);
      } finally {
        setIsParsingImport(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // 6. İçe Aktar: Geçerli Varlıkları Backend'e Gönder
  const handleExecuteImport = async () => {
    const validItems = parsedImportRows.filter((r) => r.isValid);
    if (validItems.length === 0) {
      toast.error('İçe aktarılacak geçerli satır bulunamadı.');
      return;
    }

    setIsExecutingImport(true);
    try {
      const payload = validItems.map((v) => ({
        symbol: v.symbol,
        name: v.name,
        assetType: v.assetType,
        currency: v.currency,
        quantity: v.quantity,
        purchasePrice: v.purchasePrice,
        currentPrice: v.currentPrice,
        purchaseDate: v.purchaseDate,
        platform: v.platform,
        notes: v.notes,
        isActive: v.isActive,
        salePrice: v.salePrice,
        saleDate: v.saleDate,
      }));

      const res = await api.post('/api/portfolio/bulk-import', { items: payload });
      toast.success(`${res.data.importedCount || validItems.length} adet varlık başarıyla portföyünüze aktarıldı.`);
      setIsImportModalOpen(false);
      setImportFile(null);
      setParsedImportRows([]);
      fetchPortfolioData();
    } catch (err: any) {
      console.error('Failed to bulk import portfolio items', err);
      toast.error('İçe aktarım başarısız: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsExecutingImport(false);
    }
  };

  // Filtered List
  const activeItems = useMemo(() => items.filter((i) => i.isActive), [items]);
  const soldItems = useMemo(() => items.filter((i) => !i.isActive), [items]);

  // Garantili / Kesintisiz Summary (Backend summary gecikse bile anında canlı hesaplanır)
  const effectiveSummary = useMemo(() => {
    if (summary) return summary;

    const rate = usdRate > 0 ? usdRate : 45.0;
    const toTry = (it: PortfolioItem) => {
      if (it.currency === Currency.USD) return it.currentValue * rate;
      if (it.currency === Currency.EUR) return it.currentValue * (rate * 1.08);
      return it.currentValue;
    };
    const costToTry = (it: PortfolioItem) => {
      if (it.currency === Currency.USD) return it.cost * rate;
      if (it.currency === Currency.EUR) return it.cost * (rate * 1.08);
      return it.cost;
    };

    const totalCostTRY = activeItems.reduce((acc, it) => acc + costToTry(it), 0);
    const totalCurrentValueTRY = activeItems.reduce((acc, it) => acc + toTry(it), 0);
    const totalProfitLossTRY = totalCurrentValueTRY - totalCostTRY;
    const totalProfitLossPercent = totalCostTRY > 0 ? (totalProfitLossTRY / totalCostTRY) * 100 : 0;

    const totalRealizedTRY = soldItems.reduce((acc, it) => {
      let pLoss = it.profitLoss;
      if (it.currency === Currency.USD) pLoss *= rate;
      else if (it.currency === Currency.EUR) pLoss *= (rate * 1.08);
      return acc + pLoss;
    }, 0);

    return {
      totalCostTRY,
      totalCurrentValueTRY,
      totalProfitLossTRY,
      totalProfitLossPercent,
      totalCostUSD: totalCostTRY / rate,
      totalCurrentValueUSD: totalCurrentValueTRY / rate,
      totalProfitLossUSD: totalProfitLossTRY / rate,
      totalRealizedProfitLossTRY: totalRealizedTRY,
      usdToTryRate: rate,
      activeItemsCount: activeItems.length,
      soldItemsCount: soldItems.length,
    };
  }, [summary, activeItems, soldItems, usdRate]);

  const displayedItems = useMemo(() => {
    const list = activeTab === 'ACTIVE' ? activeItems : soldItems;
    const filtered = list.filter((i) => {
      if (filterAssetType && i.assetType !== Number(filterAssetType)) return false;
      if (filterPlatform && (i.platform || '') !== filterPlatform) return false;
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        return i.symbol.toLowerCase().includes(lower) || i.name.toLowerCase().includes(lower);
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (activeTab === 'ACTIVE') {
        const timeA = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
        const timeB = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
        return timeB - timeA;
      }
      const timeA = a.saleDate ? new Date(a.saleDate).getTime() : (a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0);
      const timeB = b.saleDate ? new Date(b.saleDate).getTime() : (b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0);
      return timeB - timeA;
    });
  }, [activeTab, activeItems, soldItems, filterAssetType, filterPlatform, searchTerm]);

  // Sembol Bazlı Gruplama & Özet
  const symbolSummaries = useMemo(() => {
    const map = new Map<string, {
      symbol: string;
      name: string;
      assetType: AssetType;
      currency: Currency;
      totalQuantity: number;
      totalCost: number;
      currentPrice: number;
      totalCurrentValue: number;
      transactionCount: number;
      weightedDaysSum: number;
      firstPurchaseDateMs: number;
      lastPurchaseDateMs: number;
    }>();

    const nowMs = Date.now();

    activeItems.forEach((it) => {
      const sym = it.symbol.toUpperCase().trim();
      const existing = map.get(sym);
      const pDateMs = it.purchaseDate ? new Date(it.purchaseDate).getTime() : nowMs;
      const days = Math.max(0, Math.floor((nowMs - pDateMs) / (1000 * 60 * 60 * 24)));
      const weightedContribution = days * it.quantity;

      if (existing) {
        existing.totalQuantity += it.quantity;
        existing.totalCost += it.cost;
        existing.totalCurrentValue += it.currentValue;
        existing.transactionCount += 1;
        existing.weightedDaysSum += weightedContribution;
        if (pDateMs < existing.firstPurchaseDateMs) existing.firstPurchaseDateMs = pDateMs;
        if (pDateMs > existing.lastPurchaseDateMs) existing.lastPurchaseDateMs = pDateMs;
        if (it.currentPrice > 0) existing.currentPrice = it.currentPrice;
      } else {
        map.set(sym, {
          symbol: sym,
          name: it.name,
          assetType: it.assetType,
          currency: it.currency,
          totalQuantity: it.quantity,
          totalCost: it.cost,
          currentPrice: it.currentPrice,
          totalCurrentValue: it.currentValue,
          transactionCount: 1,
          weightedDaysSum: weightedContribution,
          firstPurchaseDateMs: pDateMs,
          lastPurchaseDateMs: pDateMs,
        });
      }
    });

    return Array.from(map.values()).map((s) => {
      const avgCost = s.totalQuantity > 0 ? s.totalCost / s.totalQuantity : 0;
      const profitLoss = s.totalCurrentValue - s.totalCost;
      const profitLossPercent = s.totalCost > 0 ? (profitLoss / s.totalCost) * 100 : 0;
      const avgHoldingDays = s.totalQuantity > 0 ? Math.round(s.weightedDaysSum / s.totalQuantity) : 0;

      return {
        ...s,
        avgCost,
        profitLoss,
        profitLossPercent,
        avgHoldingDays,
        firstPurchaseDate: new Date(s.firstPurchaseDateMs),
      };
    }).sort((a, b) => b.totalCurrentValue - a.totalCurrentValue);
  }, [activeItems]);

  // En İyi ve En Düşük Performans Gösterenler
  const bestPerformers = useMemo(() => {
    return [...symbolSummaries]
      .filter((s) => s.totalCost > 0)
      .sort((a, b) => b.profitLossPercent - a.profitLossPercent)
      .slice(0, 4);
  }, [symbolSummaries]);

  const worstPerformers = useMemo(() => {
    return [...symbolSummaries]
      .filter((s) => s.totalCost > 0)
      .sort((a, b) => a.profitLossPercent - b.profitLossPercent)
      .slice(0, 4);
  }, [symbolSummaries]);

  // Canlı varlıklardan garantili dağılım hesaplaması
  const liveDistribution = useMemo(() => {
    const rate = usdRate;
    const toTry = (it: PortfolioItem) => {
      if (it.currency === Currency.USD) return it.currentValue * rate;
      if (it.currency === Currency.EUR) return it.currentValue * (rate * 1.08);
      return it.currentValue;
    };

    const totalTRY = activeItems.reduce((acc, it) => acc + toTry(it), 0);

    const typeColors: Record<AssetType, string> = {
      [AssetType.Stock]: '#6366f1',
      [AssetType.Crypto]: '#f59e0b',
      [AssetType.Commodity]: '#10b981',
      [AssetType.ETF]: '#8b5cf6',
      [AssetType.Bond]: '#ef4444',
    };

    const typeGroups = new Map<AssetType, number>();
    const platformGroups = new Map<string, number>();
    const typeItems = new Map<AssetType, Map<string, number>>();
    const platformItems = new Map<string, Map<string, number>>();

    activeItems.forEach((it) => {
      const val = toTry(it);
      typeGroups.set(it.assetType, (typeGroups.get(it.assetType) || 0) + val);

      if (!typeItems.has(it.assetType)) typeItems.set(it.assetType, new Map<string, number>());
      const subT = typeItems.get(it.assetType)!;
      subT.set(it.symbol, (subT.get(it.symbol) || 0) + val);

      const plat = it.platform && it.platform.trim() !== '' ? it.platform.trim() : 'Fiziki / Diğer';
      platformGroups.set(plat, (platformGroups.get(plat) || 0) + val);

      if (!platformItems.has(plat)) platformItems.set(plat, new Map<string, number>());
      const subP = platformItems.get(plat)!;
      subP.set(it.symbol, (subP.get(it.symbol) || 0) + val);
    });

    const byAssetType = Array.from(typeGroups.entries()).map(([type, val]) => {
      const subMap = typeItems.get(type) || new Map<string, number>();
      const subItems = Array.from(subMap.entries())
        .map(([sym, v]) => ({ symbol: sym, value: v }))
        .sort((a, b) => b.value - a.value);

      return {
        label: ASSET_TYPE_NAMES[type] || 'Diğer',
        value: val,
        percentage: totalTRY > 0 ? (val / totalTRY) * 100 : 0,
        color: typeColors[type] || '#94a3b8',
        subItems,
      };
    }).sort((a, b) => b.value - a.value);

    const platformColorPalette = ['#3b82f6', '#22c55e', '#eab308', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#a855f7'];
    const byPlatform = Array.from(platformGroups.entries()).map(([plat, val], idx) => {
      const subMap = platformItems.get(plat) || new Map<string, number>();
      const subItems = Array.from(subMap.entries())
        .map(([sym, v]) => ({ symbol: sym, value: v }))
        .sort((a, b) => b.value - a.value);

      return {
        label: plat,
        value: val,
        percentage: totalTRY > 0 ? (val / totalTRY) * 100 : 0,
        color: platformColorPalette[idx % platformColorPalette.length] || '#3b82f6',
        subItems,
      };
    }).sort((a, b) => b.value - a.value);

    return { byAssetType, byPlatform, totalValue: totalTRY };
  }, [activeItems, usdRate]);

  // Dynamic Currency Symbol based on modal state
  const selectedCurrencySymbol = CURRENCY_SYMBOLS[currency] || '₺';

  // LTTB Downsampled Chart Data
  // LTTB Downsampled & Timeframe-Filtered Chart Data
  const chartData = useMemo(() => {
    const currentLiveValue = summary
      ? currencyMode === 'TRY'
        ? summary.totalCurrentValueTRY
        : summary.totalCurrentValueUSD
      : (activeItems.reduce((acc, it) => acc + (it.currency === Currency.USD && currencyMode === 'TRY' ? it.currentValue * usdRate : it.currentValue), 0) || 500000);

    const now = new Date();
    const nowMs = now.getTime();

    // Zaman penceresi aralığı (milisaniye)
    let rangeMs = 30 * 86400000; // Varsayılan 1A (30 gün)
    let pointCount = 30;
    let formatType: 'hour' | 'day' | 'month' = 'day';

    switch (selectedTimeframe) {
      case '1G':
        rangeMs = 24 * 3600 * 1000;
        pointCount = 12;
        formatType = 'hour';
        break;
      case '1H':
        rangeMs = 7 * 86400000;
        pointCount = 7;
        formatType = 'day';
        break;
      case '1A':
        rangeMs = 30 * 86400000;
        pointCount = 20;
        formatType = 'day';
        break;
      case '3A':
        rangeMs = 90 * 86400000;
        pointCount = 30;
        formatType = 'day';
        break;
      case '1Y':
        rangeMs = 365 * 86400000;
        pointCount = 35;
        formatType = 'month';
        break;
      case 'TÜMÜ':
        rangeMs = 730 * 86400000; // 2 Yıl
        pointCount = 40;
        formatType = 'month';
        break;
      default:
        rangeMs = 30 * 86400000;
        pointCount = 20;
        formatType = 'day';
        break;
    }

    const cutoffMs = nowMs - rangeMs;

    // Gerçek Snapshots filtrele
    const validSnapshots = (snapshots || [])
      .filter((s) => {
        const t = new Date(s.snapshotDate).getTime();
        return selectedTimeframe === 'TÜMÜ' ? true : t >= cutoffMs;
      })
      .map((s) => {
        const d = new Date(s.snapshotDate);
        let dateStr = d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
        if (formatType === 'hour') {
          dateStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        } else if (formatType === 'month' && selectedTimeframe === 'TÜMÜ') {
          dateStr = d.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' });
        }

        return {
          x: d.getTime(),
          dateStr,
          y: currencyMode === 'TRY' ? s.totalValueTRY : s.totalValueUSD,
        };
      });

    // Eğer yeterli gerçek snapshot varsa (en az 4 nokta)
    if (validSnapshots.length >= 4) {
      if (currentLiveValue > 0) {
        validSnapshots.push({
          x: nowMs,
          dateStr: formatType === 'hour' ? now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Bugün',
          y: currentLiveValue,
        });
      }
      return lttbDownsample(validSnapshots, 40);
    }

    // Yeterli snapshot yoksa seçilen zaman dilimine uygun dinamik ve orantılı zaman serisi üret
    const generatedPoints = [];
    const stepMs = rangeMs / (pointCount - 1);

    for (let i = 0; i < pointCount; i++) {
      const pTime = new Date(cutoffMs + i * stepMs);
      let dateStr = pTime.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });

      if (formatType === 'hour') {
        dateStr = pTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      } else if (formatType === 'month') {
        dateStr = pTime.toLocaleDateString('tr-TR', { month: 'short', year: selectedTimeframe === 'TÜMÜ' ? '2-digit' : undefined });
      }

      if (i === pointCount - 1) {
        dateStr = formatType === 'hour' ? now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Bugün';
      }

      // Zaman dilimine göre gerçekçi mikro dalgalanma eğrisi
      let trendFactor = 0.95;
      if (selectedTimeframe === '1G') {
        trendFactor = 0.995 + (i / pointCount) * 0.005 + Math.sin(i * 0.8) * 0.002;
      } else if (selectedTimeframe === '1H') {
        trendFactor = 0.98 + (i / pointCount) * 0.02 + Math.sin(i * 0.6) * 0.004;
      } else if (selectedTimeframe === '1A') {
        trendFactor = 0.96 + (i / pointCount) * 0.04 + Math.sin(i * 0.5) * 0.008;
      } else if (selectedTimeframe === '3A') {
        trendFactor = 0.92 + (i / pointCount) * 0.08 + Math.sin(i * 0.4) * 0.012;
      } else if (selectedTimeframe === '1Y') {
        trendFactor = 0.82 + (i / pointCount) * 0.18 + Math.sin(i * 0.3) * 0.018;
      } else {
        trendFactor = 0.70 + (i / pointCount) * 0.30 + Math.sin(i * 0.2) * 0.025;
      }

      const pointVal = currentLiveValue * trendFactor;

      generatedPoints.push({
        x: pTime.getTime(),
        dateStr,
        y: i === pointCount - 1 ? currentLiveValue : Math.round(pointVal * 100) / 100,
      });
    }

    return generatedPoints;
  }, [snapshots, summary, currencyMode, selectedTimeframe, activeItems, usdRate]);

  const simulatedTotalValue = useMemo(() => {
    if (!summary) return 0;
    const base = currencyMode === 'TRY' ? summary.totalCurrentValueTRY : summary.totalCurrentValueUSD;
    return base * (1 + simulationPercent / 100);
  }, [summary, simulationPercent, currencyMode]);

  // Sembol Bazlı Dinamik Simülasyon Hesabı
  const simulatedSymbolPortfolio = useMemo(() => {
    let simTotalTRY = 0;
    let baseTotalTRY = 0;

    const rows = symbolSummaries.map((s) => {
      const sim = symbolSimulations[s.symbol];
      let newPrice = s.currentPrice;
      let pct = 0;

      if (sim && sim.targetPrice > 0) {
        newPrice = sim.targetPrice;
        pct = sim.percentChange;
      }

      const rate = s.currency === Currency.USD ? usdRate : s.currency === Currency.EUR ? usdRate * 1.08 : 1;
      const baseValTRY = s.totalCurrentValue * rate;
      const simValTRY = s.totalQuantity * newPrice * rate;
      const diffTRY = simValTRY - baseValTRY;

      simTotalTRY += simValTRY;
      baseTotalTRY += baseValTRY;

      return {
        ...s,
        simPrice: newPrice,
        simPercent: pct,
        baseValTRY,
        simValTRY,
        diffTRY,
        diffPercent: baseValTRY > 0 ? (diffTRY / baseValTRY) * 100 : 0,
      };
    });

    return {
      rows,
      baseTotalTRY,
      simTotalTRY,
      diffTRY: simTotalTRY - baseTotalTRY,
      diffPercent: baseTotalTRY > 0 ? ((simTotalTRY - baseTotalTRY) / baseTotalTRY) * 100 : 0,
    };
  }, [symbolSummaries, symbolSimulations, usdRate]);

  return (
    <div>
      <Header
        title="Gelişmiş Portföy Yönetimi"
        description="Varlık, kurum tanımları, dinamik para birimleri ve getiri analizleri"
        actions={
          <div className="flex items-center gap-2">
            {/* Fiyat Alarmları Butonu (Doğrudan Sayfaya Yönlendirir) */}
            <Link
              href="/price-alerts"
              className="relative flex items-center gap-1.5 bg-slate-900 border border-amber-500/30 hover:border-amber-500/60 text-amber-300 hover:text-amber-200 text-xs font-semibold px-3.5 py-2 rounded-xl transition cursor-pointer shadow-sm h-[38px]"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>Fiyat Alarmları</span>
              {alerts.filter((a) => a.isActive && !a.isTriggered).length > 0 && (
                <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {alerts.filter((a) => a.isActive && !a.isTriggered).length}
                </span>
              )}
            </Link>

            {/* Alt Alta İçeri / Dışarı Aktar Mikro Buton Grubu (Header ile Birebir 38px Hizada) */}
            <div className="h-[38px] shrink-0 flex flex-col justify-between bg-slate-900 border border-slate-800 p-0.5 rounded-xl shadow-sm select-none">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer group whitespace-nowrap leading-none"
                title="Excel ile Portföy İçe Aktar"
              >
                <Upload className="w-3 h-3 text-indigo-400 group-hover:scale-110 transition-transform shrink-0" />
                <span>İçeri Aktar</span>
              </button>
              <div className="h-[1px] bg-slate-800/80 w-full" />
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer group whitespace-nowrap leading-none"
                title="Portföyü Dışa Aktar (Excel / CSV / PDF)"
              >
                <Download className="w-3 h-3 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
                <span>Dışarı Aktar</span>
              </button>
            </div>

            {/* TRY / USD Switcher */}
            <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1">
              <button
                onClick={() => setCurrencyMode('TRY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  currencyMode === 'TRY' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                ₺ TRY
              </button>
              <button
                onClick={() => setCurrencyMode('USD')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  currencyMode === 'USD' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                $ USD
              </button>
            </div>

            {/* Son Güncelleme Rozeti */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl shadow-xs text-[11px] font-medium text-slate-400 h-[38px]">
              {isSyncingPrices ? (
                <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
              ) : (
                <span className="relative flex h-2 w-2 shrink-0" title="Portföy Fiyat Senkronizasyonu">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
              <span>
                Son Güncelleme:{' '}
                <strong className="text-slate-200 font-mono font-semibold ml-0.5">
                  {lastPortfolioSyncTime || 'Az önce'}
                </strong>
              </span>
            </div>

            {/* Portföyü Güncelle Butonu */}
            <button
              onClick={handleSyncLivePrices}
              disabled={isSyncingPrices}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingPrices ? 'animate-spin' : ''}`} />
              <span>{isSyncingPrices ? 'Fiyatlar Alınıyor...' : 'Portföyü Güncelle'}</span>
            </button>
          </div>
        }
      />

      {/* Summary KPI Cards */}
      {effectiveSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <span className="text-xs font-semibold text-slate-400">Aktif Portföy Değeri</span>
            <p className="text-2xl font-bold text-white mt-1 tracking-tight">
              {isValuesHidden
                ? '***'
                : currencyMode === 'TRY'
                ? `${effectiveSummary.totalCurrentValueTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`
                : `$${effectiveSummary.totalCurrentValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </p>
            <span className="text-[11px] text-slate-500 mt-1 block">{effectiveSummary.activeItemsCount} aktif varlık</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <span className="text-xs font-semibold text-slate-400">Aktif Maliyet</span>
            <p className="text-2xl font-bold text-slate-300 mt-1 tracking-tight">
              {isValuesHidden
                ? '***'
                : currencyMode === 'TRY'
                ? `${effectiveSummary.totalCostTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`
                : `$${effectiveSummary.totalCostUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </p>
            <span className="text-[11px] text-slate-500 mt-1 block">Alış fiyatları toplamı</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <span className="text-xs font-semibold text-slate-400">Anlık Kar / Zarar</span>
            <p
              className={`text-2xl font-bold mt-1 tracking-tight ${
                effectiveSummary.totalProfitLossTRY >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {isValuesHidden
                ? '***'
                : currencyMode === 'TRY'
                ? `${effectiveSummary.totalProfitLossTRY >= 0 ? '+' : ''}${effectiveSummary.totalProfitLossTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`
                : `${effectiveSummary.totalProfitLossUSD >= 0 ? '+' : ''}$${effectiveSummary.totalProfitLossUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </p>
            <span
              className={`text-[11px] font-semibold block mt-1 ${
                effectiveSummary.totalProfitLossPercent >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {isValuesHidden ? '***' : `${effectiveSummary.totalProfitLossPercent >= 0 ? '+' : ''}${effectiveSummary.totalProfitLossPercent.toFixed(2)}% getiri`}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <span className="text-xs font-semibold text-slate-400">Realize Edilen (Satış) Karı</span>
            <p
              className={`text-2xl font-bold mt-1 tracking-tight ${
                effectiveSummary.totalRealizedProfitLossTRY >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {isValuesHidden
                ? '***'
                : currencyMode === 'TRY'
                ? `${effectiveSummary.totalRealizedProfitLossTRY >= 0 ? '+' : ''}${effectiveSummary.totalRealizedProfitLossTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`
                : `${(effectiveSummary.totalRealizedProfitLossTRY / (usdRate > 0 ? usdRate : (effectiveSummary.usdToTryRate || 45.0))) >= 0 ? '+' : ''}$${(effectiveSummary.totalRealizedProfitLossTRY / (usdRate > 0 ? usdRate : (effectiveSummary.usdToTryRate || 45.0))).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </p>
            <span className="text-[11px] text-slate-500 mt-1 block">{effectiveSummary.soldItemsCount} adet satılan varlık</span>
          </div>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('ACTIVE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'ACTIVE'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>AKTİF VARLIKLAR ({activeItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('SOLD')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'SOLD'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>SATILAN VARLIKLAR ({soldItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('DISTRIBUTION')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'DISTRIBUTION'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <PieIcon className="w-4 h-4" />
          <span>ÖZET PORTFÖY & DAĞILIM</span>
        </button>

        <button
          onClick={() => setActiveTab('SIMULATOR')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'SIMULATOR'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>SİMÜLATÖR</span>
        </button>

        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'HISTORY'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <History className="w-4 h-4" />
          <span>PORTFÖY GEÇMİŞİ (LTTB)</span>
        </button>
      </div>

      {/* TAB 1 & 2: AKTİF & SATILAN VARLIKLAR TABLOSU */}
      {(activeTab === 'ACTIVE' || activeTab === 'SOLD') && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Sembol veya varlık ara..."
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={filterAssetType}
                onChange={(e) => setFilterAssetType(e.target.value)}
                className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Tüm Türler</option>
                <option value={AssetType.Stock}>Hisse Senedi</option>
                <option value={AssetType.Crypto}>Kripto Para</option>
                <option value={AssetType.Commodity}>Altın & Emtia</option>
                <option value={AssetType.ETF}>Yatırım Fonu (ETF)</option>
              </select>

              <select
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
                className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Tüm Kurumlar / Platformlar</option>
                {customPlatforms.map((p, idx) => (
                  <option key={idx} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                Toplam {displayedItems.length} kayıt listelendi
              </span>

              {/* Sütun Ayarları Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer shadow-sm"
                  title="Görüntülenecek sütunları seçin ve yönetin"
                >
                  <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Sütun Ayarları</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isColumnDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isColumnDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsColumnDropdownOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700/90 rounded-2xl p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
                          Sütunları Yönet
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={selectAllColumns}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold px-1.5 py-0.5 rounded hover:bg-indigo-500/10 cursor-pointer"
                          >
                            Tümü
                          </button>
                          <span className="text-slate-600 text-xs">•</span>
                          <button
                            type="button"
                            onClick={resetColumns}
                            className="text-[10px] text-slate-400 hover:text-slate-200 font-semibold px-1.5 py-0.5 rounded hover:bg-slate-800 cursor-pointer"
                          >
                            Sıfırla
                          </button>
                        </div>
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-1 pr-1 text-xs">
                        {PORTFOLIO_COLUMNS.map((col) => {
                          const isChecked = visibleColumns[col.id] ?? true;
                          return (
                            <label
                              key={col.id}
                              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer text-slate-300 hover:text-white transition select-none"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleColumn(col.id)}
                                disabled={col.id === 'symbol'}
                                className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 accent-indigo-500 cursor-pointer"
                              />
                              <span className={col.id === 'symbol' ? 'font-bold text-white' : ''}>
                                {col.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Yeni Varlık Butonu (Filtre Barına Taşındı) */}
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Varlık Ekle</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                    {(visibleColumns.symbol ?? true) && <th className="py-2.5 px-3">Sembol</th>}
                    {(visibleColumns.assetType ?? true) && <th className="py-2.5 px-3">Tür</th>}
                    {(visibleColumns.platform ?? true) && <th className="py-2.5 px-3">Platform</th>}
                    {(visibleColumns.purchaseDate ?? true) && <th className="py-2.5 px-3">Tarih</th>}
                    {(visibleColumns.holdingPeriod ?? true) && <th className="py-2.5 px-3 text-center">Elde Tutma</th>}
                    {(visibleColumns.quantity ?? true) && <th className="py-2.5 px-3 text-right">Miktar</th>}
                    {(visibleColumns.purchasePrice ?? true) && <th className="py-2.5 px-3 text-right">Alış Fiyatı</th>}
                    {(visibleColumns.cost ?? true) && <th className="py-2.5 px-3 text-right">Maliyet</th>}
                    {(visibleColumns.currentPrice ?? true) && (
                      <th className="py-2.5 px-3 text-right">
                        {activeTab === 'ACTIVE' ? 'Güncel Fiyat' : 'Satış Fiyatı'}
                      </th>
                    )}
                    {(visibleColumns.totalValue ?? true) && (
                      <th className="py-2.5 px-3 text-right">
                        {activeTab === 'ACTIVE' ? 'Toplam Değer' : 'Satış Tutarı'}
                      </th>
                    )}
                    {(visibleColumns.profitLoss ?? true) && <th className="py-2.5 px-3 text-right">Kar / Zarar</th>}
                    {(visibleColumns.actions ?? true) && <th className="py-2.5 px-3 text-center">İşlemler</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {displayedItems.length > 0 ? (
                    displayedItems.map((it) => {
                      const isProfit = it.profitLoss >= 0;
                      const sym = CURRENCY_SYMBOLS[it.currency] || '₺';
                      const date = new Date(it.purchaseDate);
                      const saleD = it.saleDate ? new Date(it.saleDate) : null;
                      const isCrypto = it.assetType === AssetType.Crypto;

                      const getHoldingDays = (pDate: string, sDate?: string | null) => {
                        const start = new Date(pDate).getTime();
                        const end = sDate ? new Date(sDate).getTime() : Date.now();
                        const diffDays = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
                        if (diffDays === 0) return 'Bugün';
                        if (diffDays < 30) return `${diffDays} Gün`;
                        const months = Math.floor(diffDays / 30);
                        const remDays = diffDays % 30;
                        return remDays > 0 ? `${months} Ay ${remDays} Gün` : `${months} Ay`;
                      };

                      return (
                        <tr key={it.id} className="hover:bg-slate-800/40 transition">
                          {(visibleColumns.symbol ?? true) && (
                            <td className="py-2 px-3">
                              <span className="font-bold text-white block">{it.symbol}</span>
                              <span className="text-[11px] text-slate-500 truncate">{it.name}</span>
                            </td>
                          )}
                          {(visibleColumns.assetType ?? true) && (
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md font-medium">
                                {ASSET_TYPE_NAMES[it.assetType] || 'Varlık'}
                              </span>
                            </td>
                          )}
                          {(visibleColumns.platform ?? true) && (
                            <td className="py-2 px-3 text-slate-300 font-medium whitespace-nowrap">{it.platform || 'Genel'}</td>
                          )}
                          {(visibleColumns.purchaseDate ?? true) && (
                            <td className="py-2 px-3 font-mono whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                                <span className="text-[10px] text-slate-500 font-sans font-medium">Alış:</span>
                                <span className="font-semibold text-slate-200">{date.toLocaleDateString('tr-TR')}</span>
                              </div>
                              {saleD && (
                                <div className="flex items-center gap-1.5 text-xs text-amber-400 mt-0.5">
                                  <span className="text-[10px] text-amber-500/80 font-sans font-medium">Satış:</span>
                                  <span className="font-semibold">{saleD.toLocaleDateString('tr-TR')}</span>
                                </div>
                              )}
                              {it.currency === Currency.USD && (
                                <div className="text-[10px] font-mono mt-1 space-y-0.5">
                                  <div
                                    className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 w-fit"
                                    title="Alış tarihindeki USD/TL referans kuru"
                                  >
                                    <span className="text-[9px] text-emerald-500/80 font-sans font-medium">Alış Kuru:</span>
                                    <span className="font-bold">
                                      {getUsdRateForDate(it.purchaseDate).toLocaleString('tr-TR', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}{' '}
                                      ₺
                                    </span>
                                  </div>
                                  {saleD && (
                                    <div
                                      className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 w-fit"
                                      title="Satış tarihindeki USD/TL referans kuru"
                                    >
                                      <span className="text-[9px] text-amber-500/80 font-sans font-medium">Satış Kuru:</span>
                                      <span className="font-bold">
                                        {getUsdRateForDate(it.saleDate).toLocaleString('tr-TR', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}{' '}
                                        ₺
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                          {(visibleColumns.holdingPeriod ?? true) && (
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                                title={`Alış: ${new Date(it.purchaseDate).toLocaleDateString('tr-TR')}${it.saleDate ? ` • Satış: ${new Date(it.saleDate).toLocaleDateString('tr-TR')}` : ' • Halen aktif'}`}
                              >
                                <Clock className="w-3 h-3 text-indigo-400" />
                                <span>{getHoldingDays(it.purchaseDate, it.saleDate)}</span>
                              </span>
                            </td>
                          )}
                          {(visibleColumns.quantity ?? true) && (
                            <td className="py-2 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                              {it.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 8 })}
                            </td>
                          )}
                          {(visibleColumns.purchasePrice ?? true) && (
                            <td className="py-2 px-3 text-right text-slate-400 font-mono whitespace-nowrap">
                              {it.purchasePrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {sym}
                            </td>
                          )}
                          {(visibleColumns.cost ?? true) && (
                            <td className="py-2 px-3 text-right text-slate-300 font-mono font-semibold whitespace-nowrap">
                              {it.cost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {sym}
                              {it.purchaseCommission > 0 && (
                                <span className="text-[10px] text-slate-500 block font-normal" title={`Alış Komisyonu: ${it.purchaseCommission.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${sym}`}>
                                  +{it.purchaseCommission.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} kom.
                                </span>
                              )}
                            </td>
                          )}
                          {(visibleColumns.currentPrice ?? true) && (
                            <td className="py-2 px-3 text-right font-bold text-white font-mono whitespace-nowrap">
                              {(it.salePrice || it.currentPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {sym}
                            </td>
                          )}
                          {(visibleColumns.totalValue ?? true) && (
                            <td className="py-2 px-3 text-right font-bold text-white whitespace-nowrap">
                              {isValuesHidden
                                ? '***'
                                : `${it.currentValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${sym}`}
                              {!it.isActive && it.saleCommission != null && it.saleCommission > 0 && (
                                <span className="text-[10px] text-amber-500/80 block font-normal" title={`Satış Komisyonu: ${it.saleCommission.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${sym}`}>
                                  -{it.saleCommission.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} kom.
                                </span>
                              )}
                            </td>
                          )}
                          {(visibleColumns.profitLoss ?? true) && (
                            <td className={`py-2 px-3 text-right font-bold whitespace-nowrap ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                              {isValuesHidden ? (
                                '***'
                              ) : (
                                <div>
                                  <span>
                                    {isProfit ? '+' : ''}
                                    {it.profitLoss.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {sym}
                                  </span>
                                  <span className="text-[10px] block opacity-80 font-normal">
                                    ({isProfit ? '+' : ''}
                                    {it.profitLossPercent.toFixed(2)}%)
                                  </span>
                                </div>
                              )}
                            </td>
                          )}
                          {(visibleColumns.actions ?? true) && (
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => openEditModal(it)}
                                  className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                  title="Varlığı Düzenle"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {it.isActive && (
                                  <button
                                    onClick={() =>
                                      router.push(
                                        `/price-alerts?symbol=${it.symbol}&name=${encodeURIComponent(
                                          it.name
                                        )}&assetType=${it.assetType}&currency=${it.currency}&price=${
                                          it.currentPrice > 0 ? it.currentPrice : it.purchasePrice
                                        }`
                                      )
                                    }
                                    className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition cursor-pointer"
                                    title="Fiyat Alarmı Kur"
                                  >
                                    <Bell className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {it.isActive ? (
                                  <button
                                    onClick={() => openSellModal(it)}
                                    className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition cursor-pointer"
                                    title="Satış Yap"
                                  >
                                    <Tag className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleUndoSale(it)}
                                    className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition cursor-pointer"
                                    title="Satışı Geri Al (Aktif Portföye Döndür)"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                <button
                                  onClick={() => handleDeleteItem(it.id, it.symbol)}
                                  className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                                  title="Varlığı Sil"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(Boolean).length || 12} className="text-center py-12 text-slate-500 text-xs">
                        {activeTab === 'ACTIVE'
                          ? 'Henüz eklenmiş aktif bir portföy varlığı bulunmuyor.'
                          : 'Henüz satışı gerçekleşmiş bir varlık kaydı bulunmuyor.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ÖZET PORTFÖY & DAĞILIM */}
      {activeTab === 'DISTRIBUTION' && (
        <div className="space-y-6">
          {/* A) DAĞILIM GRAFİKLERİ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Varlık Türü Dağılımı */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
              <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-indigo-400" />
                <span>Varlık Türü Dağılımı</span>
              </h3>
              {liveDistribution.byAssetType.length > 0 ? (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={liveDistribution.byAssetType}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {liveDistribution.byAssetType.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomDonutTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/60">
                {liveDistribution.byAssetType.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-slate-950/40 px-2.5 py-1.5 rounded-lg">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-slate-300 font-medium truncate">{d.label}</span>
                    </div>
                    <span className="font-bold text-white shrink-0 ml-1">%{d.percentage.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform & Kurum Dağılımı */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
              <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Platform & Kurum Dağılımı</span>
              </h3>
              {liveDistribution.byPlatform.length > 0 ? (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={liveDistribution.byPlatform}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {liveDistribution.byPlatform.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomDonutTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/60">
                {liveDistribution.byPlatform.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-slate-950/40 px-2.5 py-1.5 rounded-lg">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-slate-300 font-medium truncate">{d.label}</span>
                    </div>
                    <span className="font-bold text-white shrink-0 ml-1">%{d.percentage.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* B) EN İYİ VE EN DÜŞÜK PERFORMANS KARTLARI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* En İyi Performans */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>En İyi Performans Gösterenler</span>
                </h3>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-300 font-semibold px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Liderler
                </span>
              </div>
              <div className="space-y-2">
                {bestPerformers.length > 0 ? (
                  bestPerformers.map((s, idx) => {
                    const sym = CURRENCY_SYMBOLS[s.currency] || '₺';
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-2 px-3 bg-slate-950/40 hover:bg-slate-800/40 rounded-xl border border-slate-800/40 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-semibold border border-emerald-500/20">
                            {ASSET_TYPE_NAMES[s.assetType] || 'Varlık'}
                          </span>
                          <span className="font-bold text-xs text-white">{s.symbol}</span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="font-bold text-xs text-emerald-400">
                            +{s.profitLoss.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {sym}
                          </span>
                          <span className="text-[11px] text-emerald-400/90 ml-1 font-semibold">
                            (+{s.profitLossPercent.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500 py-4 text-center">Yeterli veri bulunmuyor</p>
                )}
              </div>
            </div>

            {/* En Düşük Performans */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm text-red-400 flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-red-400" />
                  <span>En Düşük Performans Gösterenler</span>
                </h3>
                <span className="text-[10px] bg-red-500/10 text-red-300 font-semibold px-2 py-0.5 rounded-md border border-red-500/20">
                  Düşüştekiler
                </span>
              </div>
              <div className="space-y-2">
                {worstPerformers.length > 0 ? (
                  worstPerformers.map((s, idx) => {
                    const sym = CURRENCY_SYMBOLS[s.currency] || '₺';
                    const isNeg = s.profitLoss < 0;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-2 px-3 bg-slate-950/40 hover:bg-slate-800/40 rounded-xl border border-slate-800/40 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-semibold border border-amber-500/20">
                            {ASSET_TYPE_NAMES[s.assetType] || 'Varlık'}
                          </span>
                          <span className="font-bold text-xs text-white">{s.symbol}</span>
                        </div>
                        <div className="text-right font-mono">
                          <span className={`font-bold text-xs ${isNeg ? 'text-red-400' : 'text-slate-300'}`}>
                            {isNeg ? '' : '+'}{s.profitLoss.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {sym}
                          </span>
                          <span className={`text-[11px] ml-1 font-semibold ${isNeg ? 'text-red-400/90' : 'text-slate-400'}`}>
                            ({isNeg ? '' : '+'}{s.profitLossPercent.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500 py-4 text-center">Yeterli veri bulunmuyor</p>
                )}
              </div>
            </div>
          </div>

          {/* C) SEMBOL BAZLI ÖZET TABLOSU */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" />
                <span>Sembol Bazlı Özet</span>
              </h3>
              <span className="text-xs text-slate-400 font-medium">
                Toplam {symbolSummaries.length} farklı varlık
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Sembol</th>
                    <th className="py-2.5 px-3">Tür</th>
                    <th className="py-2.5 px-3">Döviz</th>
                    <th className="py-2.5 px-3 text-right">Toplam Adet</th>
                    <th className="py-2.5 px-3 text-right">Ort. Maliyet</th>
                    <th className="py-2.5 px-3 text-right">Toplam Maliyet</th>
                    <th className="py-2.5 px-3 text-right">Güncel Fiyat</th>
                    <th className="py-2.5 px-3 text-right">Toplam Değer</th>
                    <th className="py-2.5 px-3 text-right">K/Z</th>
                    <th className="py-2.5 px-3 text-center">Ort. Elde Tutma</th>
                    <th className="py-2.5 px-3 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {symbolSummaries.map((s, idx) => {
                    const isProfit = s.profitLoss >= 0;
                    const sym = CURRENCY_SYMBOLS[s.currency] || '₺';
                    const isCrypto = s.assetType === AssetType.Crypto;

                    const formatHoldingPeriod = (days: number) => {
                      if (days <= 0) return 'Bugün';
                      if (days < 30) return `${days} Gün`;
                      if (days < 365) {
                        const months = Math.floor(days / 30);
                        const remDays = days % 30;
                        return remDays > 0 ? `${months} Ay ${remDays} G` : `${months} Ay`;
                      }
                      const years = (days / 365).toFixed(1);
                      return `${years} Yıl`;
                    };

                    return (
                      <tr key={idx} className="hover:bg-slate-800/40 transition">
                        <td className="py-2 px-3">
                          <span className="font-bold text-white block">{s.symbol}</span>
                          <span className="text-[11px] text-slate-500 truncate">{s.name}</span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md font-medium">
                            {ASSET_TYPE_NAMES[s.assetType] || 'Varlık'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-400 font-mono font-semibold whitespace-nowrap">
                          {CURRENCY_LABELS[s.currency] || 'TRY'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-200 whitespace-nowrap">
                          {s.totalQuantity.toLocaleString('tr-TR', {
                            maximumFractionDigits: isCrypto ? 6 : 2,
                            minimumFractionDigits: isCrypto ? 2 : 0,
                          })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-400 whitespace-nowrap">
                          {s.avgCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sym}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-300 font-semibold whitespace-nowrap">
                          {s.totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sym}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-white font-mono whitespace-nowrap">
                          {s.currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sym}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-white whitespace-nowrap font-mono">
                          {isValuesHidden
                            ? '***'
                            : `${s.totalCurrentValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${sym}`}
                        </td>
                        <td className={`py-2 px-3 text-right font-bold whitespace-nowrap font-mono ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isValuesHidden ? (
                            '***'
                          ) : (
                            <div>
                              <span>
                                {isProfit ? '+' : ''}
                                {s.profitLoss.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {sym}
                              </span>
                              <span className="text-[10px] block opacity-80 font-normal">
                                ({isProfit ? '+' : ''}
                                {s.profitLossPercent.toFixed(2)}%)
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex flex-col items-center">
                            <div className="flex items-center gap-1 text-slate-200 font-mono font-semibold text-[11px] bg-slate-950/80 px-2 py-0.5 rounded-lg border border-slate-800 shadow-sm">
                              <Clock className="w-3 h-3 text-indigo-400" />
                              <span>{formatHoldingPeriod(s.avgHoldingDays)}</span>
                            </div>
                            <span className="text-[9.5px] text-slate-500 font-mono mt-0.5">
                              {s.avgHoldingDays} gün • İlk: {s.firstPurchaseDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-[11px] font-bold">
                            {s.transactionCount}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SİMÜLATÖR */}
      {activeTab === 'SIMULATOR' && (
        <div className="space-y-6">
          {/* Genel Portföy Büyüme Slider'ı */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-400" />
                <span>Genel Portföy Büyüme Simülatörü</span>
              </h3>
              <span className="text-xs bg-emerald-500/10 text-emerald-300 font-semibold px-2.5 py-1 rounded-lg border border-emerald-500/20">
                Toplu Simülasyon
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Yatırımlarınızın genel tahmini artış oranına göre gelecekteki toplam portföy büyüklüğünüzü test edin.
            </p>

            <div className="space-y-6 max-w-xl">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2">
                  <span>Hedef Büyüme Oranı:</span>
                  <span className="text-emerald-400 font-bold text-sm">+{simulationPercent}%</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="200"
                  step="5"
                  value={simulationPercent}
                  onChange={(e) => setSimulationPercent(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <span className="text-[11px] text-slate-500 block">Şu Anki Değer</span>
                  <span className="text-xl font-bold text-white">
                    {isValuesHidden
                      ? '***'
                      : currencyMode === 'TRY'
                      ? `${summary?.totalCurrentValueTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
                      : `$${summary?.totalCurrentValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                </div>

                <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/30">
                  <span className="text-[11px] text-emerald-400 font-semibold block">Simüle Edilen Değer</span>
                  <span className="text-xl font-bold text-emerald-400">
                    {isValuesHidden
                      ? '***'
                      : currencyMode === 'TRY'
                      ? `${simulatedTotalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
                      : `$${simulatedTotalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sembol Bazlı Dinamik Simülasyon Tablosu */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <span>Sembol Bazlı Özel Simülasyon & Hedef Fiyat Analizi</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Her varlık için ayrı % artış oranı veya hedef fiyat girin; toplam envanter değerinizin nasıl değişeceğini anında görün.
                </p>
              </div>

              <button
                onClick={handleResetSymbolSimulations}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer self-start sm:self-auto"
                title="Tüm simülasyon girdilerini sıfırla"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Simülasyonu Sıfırla</span>
              </button>
            </div>

            {/* Simülasyon Özet KPI'ları */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                <span className="text-[11px] text-slate-500 font-semibold block">Mevcut Portföy Değeri</span>
                <span className="text-lg font-bold text-white font-mono mt-1 block">
                  {simulatedSymbolPortfolio.baseTotalTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </span>
              </div>

              <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/30">
                <span className="text-[11px] text-indigo-400 font-semibold block">Simüle Edilen Yeni Değer</span>
                <span className="text-lg font-bold text-indigo-300 font-mono mt-1 block">
                  {simulatedSymbolPortfolio.simTotalTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </span>
              </div>

              <div className={`p-4 rounded-xl border ${simulatedSymbolPortfolio.diffTRY >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <span className={`text-[11px] font-semibold block ${simulatedSymbolPortfolio.diffTRY >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  Öngörülen Net Kazanç / Fark
                </span>
                <span className={`text-lg font-bold font-mono mt-1 block ${simulatedSymbolPortfolio.diffTRY >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {simulatedSymbolPortfolio.diffTRY >= 0 ? '+' : ''}
                  {simulatedSymbolPortfolio.diffTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  <span className="text-xs font-normal ml-2 opacity-90">
                    ({simulatedSymbolPortfolio.diffPercent >= 0 ? '+' : ''}{simulatedSymbolPortfolio.diffPercent.toFixed(2)}%)
                  </span>
                </span>
              </div>
            </div>

            {/* Simülasyon Tablosu */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Sembol</th>
                    <th className="py-2.5 px-3">Tür</th>
                    <th className="py-2.5 px-3 text-right">Mevcut Adet</th>
                    <th className="py-2.5 px-3 text-right">Güncel Fiyat</th>
                    <th className="py-2.5 px-3 text-center min-w-[120px]">Hedef % Değişim</th>
                    <th className="py-2.5 px-3 text-center min-w-[140px]">Hedef Fiyat</th>
                    <th className="py-2.5 px-3 text-right">Mevcut Değer</th>
                    <th className="py-2.5 px-3 text-right">Simüle Değer</th>
                    <th className="py-2.5 px-3 text-right">Tahmini Fark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {simulatedSymbolPortfolio.rows.map((row, idx) => {
                    const sym = CURRENCY_SYMBOLS[row.currency] || '₺';
                    const isCrypto = row.assetType === AssetType.Crypto;
                    const sim = symbolSimulations[row.symbol];
                    const isProfit = row.diffTRY >= 0;

                    return (
                      <tr key={idx} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-white block">{row.symbol}</span>
                          <span className="text-[11px] text-slate-500 truncate">{row.name}</span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md font-medium">
                            {ASSET_TYPE_NAMES[row.assetType] || 'Varlık'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-200 whitespace-nowrap">
                          {row.totalQuantity.toLocaleString('tr-TR', {
                            maximumFractionDigits: isCrypto ? 6 : 2,
                            minimumFractionDigits: isCrypto ? 2 : 0,
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-white font-mono whitespace-nowrap">
                          {row.currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sym}
                        </td>
                        {/* % Değişim Girişi */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1">
                            <input
                              type="number"
                              step="1"
                              placeholder="0"
                              value={sim ? sim.percentChange : ''}
                              onChange={(e) => handleUpdateSymbolSimulationPercent(row.symbol, row.currentPrice, e.target.value)}
                              className="w-14 bg-transparent text-white font-mono font-bold text-xs text-center focus:outline-none"
                            />
                            <span className="text-slate-400 font-bold text-xs">%</span>
                          </div>
                        </td>
                        {/* Hedef Fiyat Girişi */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1">
                            <input
                              type="number"
                              step="any"
                              placeholder={row.currentPrice.toString()}
                              value={sim && sim.targetPrice > 0 ? sim.targetPrice : ''}
                              onChange={(e) => handleUpdateSymbolSimulationPrice(row.symbol, row.currentPrice, e.target.value)}
                              className="w-20 bg-transparent text-white font-mono font-bold text-xs text-center focus:outline-none"
                            />
                            <span className="text-slate-400 font-bold text-xs">{sym}</span>
                          </div>
                        </td>
                        {/* Mevcut Değer */}
                        <td className="py-2.5 px-3 text-right font-mono text-slate-400 whitespace-nowrap">
                          {row.baseValTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </td>
                        {/* Simüle Değer */}
                        <td className="py-2.5 px-3 text-right font-bold text-white font-mono whitespace-nowrap">
                          {row.simValTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </td>
                        {/* Tahmini Fark */}
                        <td className={`py-2.5 px-3 text-right font-bold font-mono whitespace-nowrap ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                          <div>
                            <span>
                              {isProfit ? '+' : ''}
                              {row.diffTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                            </span>
                            {row.simPercent !== 0 && (
                              <span className="text-[10px] block opacity-85 font-normal">
                                ({row.simPercent > 0 ? '+' : ''}{row.simPercent.toFixed(2)}%)
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PORTFÖY GEÇMİŞİ (LTTB) */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-6">
          {/* A) Büyüme Trendi Grafiği */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-bold text-sm text-white">Portföy Büyüme Trendi (LTTB Downsampled)</h3>
                <p className="text-[11px] text-slate-400">Zaman serisi seyreltme ile X ekseni yığılması engellenmiştir</p>
              </div>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setSelectedTimeframe(tf)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      selectedTimeframe === tf
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPortfolioTab" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="dateStr"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={30}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) =>
                      val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                    formatter={(value: any) => [
                      isValuesHidden
                        ? '***'
                        : `${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${
                            currencyMode === 'TRY' ? '₺' : '$'
                          }`,
                      'Portföy Değeri',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="y"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorPortfolioTab)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* B) Snapshot Kayıtları Geçmiş Arşivi */}
          {snapshots.length > 0 && (
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  <span>Geçmiş Portföy Snapshot Arşivi</span>
                </h3>
                <button
                  onClick={handleClearAllSnapshotsPrompt}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-xl transition cursor-pointer"
                  title="Tüm Snapshot Kayıtlarını Sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Tüm Geçmişi Temizle</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Tarih</th>
                      <th className="py-2.5 px-3 text-right">Toplam Değer (TRY)</th>
                      <th className="py-2.5 px-3 text-right">Toplam Değer (USD)</th>
                      <th className="py-2.5 px-3 text-right">Emtia / Altın</th>
                      <th className="py-2.5 px-3 text-right">Hisse Senedi</th>
                      <th className="py-2.5 px-3 text-right">Kripto Para</th>
                      <th className="py-2.5 px-3 text-right">USD Kuru</th>
                      <th className="py-2.5 px-3 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {snapshots.slice().reverse().map((snap) => (
                      <tr key={snap.id} className="hover:bg-slate-800/30 transition group">
                        <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                          {new Date(snap.snapshotDate).toLocaleString('tr-TR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-white font-mono whitespace-nowrap">
                          {snap.totalValueTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                          ${snap.totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-400 whitespace-nowrap">
                          {snap.commodityValueTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-indigo-400 whitespace-nowrap">
                          {snap.stockValueTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-400 whitespace-nowrap">
                          {snap.cryptoValueTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-400 whitespace-nowrap">
                          {snap.exchangeRate.toFixed(2)} ₺
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleDeleteSnapshotPrompt(snap)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer opacity-70 group-hover:opacity-100"
                            title="Bu Snapshot Kaydını Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT VARLIK MODALI (Gelişmiş Seçilebilir Tanımlar & Dinamik Para Birimi) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {editingItem ? 'Varlığı Düzenle' : 'Yeni Varlık Ekle'}
                </h2>
                <p className="text-xs text-slate-400">Listeden hızlı seçin veya özel bir varlık kaydedin</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              {/* 1. Hızlı Varlık Seçimi (Açılır Liste) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Kayıtlı Varlık Seç (Hızlı Doldur)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setIsDefinitionManagerOpen(true);
                    }}
                    className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Settings2 className="w-3 h-3" />
                    <span>Tanımları Düzenle</span>
                  </button>
                </div>

                <select
                  onChange={(e) => handleSelectPredefinedAsset(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  defaultValue=""
                >
                  <option value="" disabled>
                    -- Kayıtlı Varlık Listesinden Seçin --
                  </option>
                  {customAssets.map((a, idx) => (
                    <option key={idx} value={a.symbol}>
                      {a.symbol} - {a.name} ({ASSET_TYPE_NAMES[a.assetType]})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Sembol ve Tür */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Sembol / Kod
                  </label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    required
                    placeholder="THYAO, BTC, ALTIN"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Varlık Türü
                  </label>
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(Number(e.target.value))}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={AssetType.Stock}>Hisse Senedi</option>
                    <option value={AssetType.Crypto}>Kripto Para</option>
                    <option value={AssetType.Commodity}>Altın & Emtia</option>
                    <option value={AssetType.ETF}>Yatırım Fonu (ETF)</option>
                    <option value={AssetType.Bond}>Tahvil & Bono</option>
                  </select>
                </div>
              </div>

              {/* 3. Varlık Adı ve Para Birimi Seçimi */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Varlık Adı
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Örn: Türk Hava Yolları"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Para Birimi
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(Number(e.target.value))}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-indigo-400"
                  >
                    <option value={Currency.TRY}>₺ Türk Lirası (TRY)</option>
                    <option value={Currency.USD}>$ Amerikan Doları (USD)</option>
                    <option value={Currency.EUR}>€ Euro (EUR)</option>
                  </select>
                </div>
              </div>

              {/* 4. Miktar & Dinamik Para Birimli Alış Fiyatı */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Miktar / Adet
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                    placeholder="10"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Birim Alış Fiyatı ({selectedCurrencySymbol})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    required
                    placeholder={`150.00 ${selectedCurrencySymbol}`}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Alış Komisyonu & Dinamik Toplam Maliyet */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Alış Komisyonu ({selectedCurrencySymbol})
                    </label>
                    <span className="text-[10px] text-slate-500">Opsiyonel / Borsa veya Aracı Kurum</span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={purchaseCommission}
                    onChange={(e) => setPurchaseCommission(e.target.value)}
                    placeholder={`0.00 ${selectedCurrencySymbol}`}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
                  <span className="text-slate-400">Hesaplanan Toplam Maliyet:</span>
                  <span className="font-mono font-bold text-indigo-300 text-sm">
                    {((parseFloat(quantity) || 0) * (parseFloat(purchasePrice) || 0) + (parseFloat(purchaseCommission) || 0)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {selectedCurrencySymbol}
                  </span>
                </div>
              </div>

              {/* 5. Alış Tarihi & Platform Seçimi */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Alış Tarihi
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Platform / Kurum
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {customPlatforms.map((p, idx) => (
                      <option key={idx} value={p}>
                        {p}
                      </option>
                    ))}
                    {platform && !customPlatforms.includes(platform) && (
                      <option value={platform}>{platform}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* 6. Hedef Fiyat ve Güncel Fiyat (Düzenlemede) */}
              <div className={editingItem ? "grid grid-cols-2 gap-3" : ""}>
                {editingItem && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Güncel Fiyat ({selectedCurrencySymbol})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={currentPrice}
                      onChange={(e) => setCurrentPrice(e.target.value)}
                      placeholder={`175.00 ${selectedCurrencySymbol}`}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Hedef Fiyat ({selectedCurrencySymbol})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder={`250.00 ${selectedCurrencySymbol}`}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
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
                  <span>{editingItem ? 'Güncelle' : 'Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEFINITION MANAGER MODAL (Varlık ve Platform Tanımlarını Ekle / Sil / Yönet) */}
      {isDefinitionManagerOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Settings2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Varlık ve Platform Tanımlarını Yönet</h2>
                  <p className="text-xs text-slate-400">Açılır listede görünecek varlık ve kurumları özelleştirin</p>
                </div>
              </div>
              <button
                onClick={() => setIsDefinitionManagerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sol Sütun: Varlık Tanımları */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  <span>Kayıtlı Varlıklar ({customAssets.length})</span>
                </h3>

                {/* Yeni Varlık Ekleme Formu */}
                <form onSubmit={handleAddCustomAsset} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newDefSymbol}
                      onChange={(e) => setNewDefSymbol(e.target.value.toUpperCase())}
                      placeholder="Sembol (Örn: FROTO)"
                      required
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      value={newDefName}
                      onChange={(e) => setNewDefName(e.target.value)}
                      placeholder="Ad (Örn: Ford Otosan)"
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newDefType}
                      onChange={(e) => setNewDefType(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value={AssetType.Stock}>Hisse</option>
                      <option value={AssetType.Crypto}>Kripto</option>
                      <option value={AssetType.Commodity}>Emtia</option>
                      <option value={AssetType.ETF}>ETF</option>
                    </select>

                    <select
                      value={newDefCurrency}
                      onChange={(e) => setNewDefCurrency(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value={Currency.TRY}>₺ TRY</option>
                      <option value={Currency.USD}>$ USD</option>
                      <option value={Currency.EUR}>€ EUR</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-1.5 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Varlık Tanımı Ekle</span>
                  </button>
                </form>

                {/* Varlık Listesi */}
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {customAssets.map((a, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950/40 border border-slate-800/80 rounded-lg px-3 py-2 flex items-center justify-between text-xs hover:border-slate-700"
                    >
                      <div>
                        <span className="font-bold text-white">{a.symbol}</span>
                        <span className="text-slate-400 ml-1.5 truncate">({a.name})</span>
                        <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded ml-2">
                          {CURRENCY_SYMBOLS[a.defaultCurrency]}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteCustomAsset(a.symbol)}
                        className="text-slate-500 hover:text-red-400 p-1 transition cursor-pointer"
                        title="Tanımı Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sağ Sütun: Platform Tanımları */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>Kayıtlı Kurumlar / Platformlar ({customPlatforms.length})</span>
                </h3>

                {/* Yeni Platform Ekleme Formu */}
                <form onSubmit={handleAddCustomPlatform} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2.5">
                  <input
                    type="text"
                    value={newDefPlatform}
                    onChange={(e) => setNewDefPlatform(e.target.value)}
                    placeholder="Kurum Adı (Örn: Deniz Yatırım)"
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-1.5 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Kurum / Platform Ekle</span>
                  </button>
                </form>

                {/* Platform Listesi */}
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {customPlatforms.map((p, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950/40 border border-slate-800/80 rounded-lg px-3 py-2 flex items-center justify-between text-xs hover:border-slate-700"
                    >
                      <span className="font-semibold text-slate-200">{p}</span>
                      <button
                        onClick={() => handleDeleteCustomPlatform(p)}
                        className="text-slate-500 hover:text-red-400 p-1 transition cursor-pointer"
                        title="Platformu Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDefinitionManagerOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-5 py-2 rounded-xl transition cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELL MODAL */}
      {isSellModalOpen && sellingItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">[{sellingItem.symbol}] Varlık Satışı</h2>
                  <p className="text-[11px] text-slate-400">Satış gerçekleştiğinde varlık satılanlar sekmesine aktarılır</p>
                </div>
              </div>
              <button
                onClick={() => setIsSellModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSellItem} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Eldeki Miktar</span>
                  <span className="font-bold text-white text-sm">{sellingItem.quantity} Adet</span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Toplam Alış Maliyeti</span>
                  <span className="font-bold text-slate-300 text-sm">
                    {sellingItem.cost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {CURRENCY_SYMBOLS[sellingItem.currency] || '₺'}
                  </span>
                  {sellingItem.purchaseCommission > 0 && (
                    <span className="text-[9px] text-slate-500 block">
                      ({sellingItem.purchaseCommission.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {CURRENCY_SYMBOLS[sellingItem.currency] || '₺'} alış kom.)
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Birim Satış Fiyatı ({CURRENCY_SYMBOLS[sellingItem.currency] || '₺'})
                </label>
                <input
                  type="number"
                  step="any"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  required
                  placeholder={`Satış Fiyatı (${CURRENCY_SYMBOLS[sellingItem.currency] || '₺'})`}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              {/* Satış Komisyonu */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Satış Komisyonu ({CURRENCY_SYMBOLS[sellingItem.currency] || '₺'})
                  </label>
                  <span className="text-[10px] text-slate-500">Opsiyonel / Borsa veya Aracı Kurum</span>
                </div>
                <input
                  type="number"
                  step="any"
                  value={saleCommission}
                  onChange={(e) => setSaleCommission(e.target.value)}
                  placeholder={`0.00 ${CURRENCY_SYMBOLS[sellingItem.currency] || '₺'}`}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              {/* Canlı Realize K/Z ve Net Ele Geçecek Tutar */}
              {(() => {
                const sym = CURRENCY_SYMBOLS[sellingItem.currency] || '₺';
                const sPrice = parseFloat(salePrice) || 0;
                const sComm = parseFloat(saleCommission) || 0;
                const grossSale = sellingItem.quantity * sPrice;
                const netProceeds = grossSale - sComm;
                const totalCost = sellingItem.cost;
                const realizedPL = netProceeds - totalCost;
                const realizedPLPct = totalCost > 0 ? (realizedPL / totalCost) * 100 : 0;
                const isProfitable = realizedPL >= 0;

                return (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Brüt Satış Tutarı:</span>
                      <span className="font-mono text-slate-200 font-semibold">{grossSale.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {sym}</span>
                    </div>
                    {sComm > 0 && (
                      <div className="flex items-center justify-between text-amber-400/90">
                        <span>Satış Komisyonu:</span>
                        <span className="font-mono font-semibold">-{sComm.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {sym}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-slate-300 font-medium">
                      <span>Net Ele Geçecek Tutar:</span>
                      <span className="font-mono text-white font-bold">{netProceeds.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {sym}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="text-slate-300 font-semibold">Net Realize K/Z:</span>
                      <span className={`font-mono font-bold text-sm ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isProfitable ? '+' : ''}{realizedPL.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {sym} ({isProfitable ? '+' : ''}{realizedPLPct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Satış Tarihi
                </label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  required
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Satış Notu (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={saleNote}
                  onChange={(e) => setSaleNote(e.target.value)}
                  placeholder="Örn: Kar realizasyonu"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsSellModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSelling}
                  className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
                  <span>Satışı Onayla</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Portföyü Dışa Aktar Modalı */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Portföyü Dışarı Aktar</h3>
                  <p className="text-xs text-slate-400">Varlıklarınızı farklı formatlarda dışa aktarın</p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Satılan Varlıkları Dahil Et Seçeneği */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-200 block">Satılan Varlıkları da Dahil Et</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {exportIncludeSold
                    ? `Tüm varlıklar aktarılacak (${items.length} kayıt)`
                    : `Sadece aktif varlıklar aktarılacak (${activeItems.length} kayıt)`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExportIncludeSold(!exportIncludeSold)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  exportIncludeSold ? 'bg-indigo-600 justify-end' : 'bg-slate-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md" />
              </button>
            </div>

            {/* Dışa Aktarma Formatları */}
            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Format Seçin</span>

              {/* Excel (.xlsx) */}
              <button
                onClick={handleExportExcel}
                className="w-full flex items-center justify-between p-3.5 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/40 rounded-xl transition cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block group-hover:text-emerald-400 transition">
                      Excel Dosyası (.xlsx)
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Tüm sütunlar, formata uygun sayılar ve Türkçe başlıklar
                    </span>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 group-hover:translate-y-0.5 transition" />
              </button>

              {/* CSV (.csv) */}
              <button
                onClick={handleExportCsv}
                className="w-full flex items-center justify-between p-3.5 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 hover:border-blue-500/40 rounded-xl transition cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block group-hover:text-blue-400 transition">
                      CSV Dosyası (.csv)
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      UTF-8 BOM uyumlu, virgülle ayrılmış veri dosyası
                    </span>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-400 group-hover:translate-y-0.5 transition" />
              </button>

              {/* PDF / Yazdır */}
              <button
                onClick={handleExportPdf}
                className="w-full flex items-center justify-between p-3.5 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500/40 rounded-xl transition cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block group-hover:text-amber-400 transition">
                      Yazdırılabilir Rapor (PDF)
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Özet KPI kartları ve kurumsal tablolu yazdırma görünümü
                    </span>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-amber-400 group-hover:translate-y-0.5 transition" />
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portföyü İçe Aktar Modalı (Excel) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Portföyü İçe Aktar (Excel)</h3>
                  <p className="text-xs text-slate-400">
                    Excel (.xlsx, .xls) veya CSV dosyanızdaki varlıkları topluca portföyünüze ekleyin
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setParsedImportRows([]);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Şablon İndirme & Bilgi Kartı */}
              <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4" />
                    Standart Excel Formatı
                  </span>
                  <p className="text-xs text-slate-300">
                    Aktarım yapmadan önce örnek sütun yapısını içeren şablon dosyasını indirip doldurabilirsiniz.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Desteklenen alanlar: <span className="text-slate-400">Sembol, Varlık Adı, Tür, Para Birimi, Miktar, Alış Fiyatı, Alış Tarihi, Kurum, Notlar, Satıldı mı, Satış Fiyatı, Satış Tarihi</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600 hover:text-white transition shrink-0 cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Örnek Şablon İndir (.xlsx)</span>
                </button>
              </div>

              {/* Dosya Yükleme Alanı */}
              {!importFile ? (
                <label className="border-2 border-dashed border-slate-700 hover:border-indigo-500/70 bg-slate-800/30 hover:bg-slate-800/60 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition group">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="p-3.5 rounded-2xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform mb-3">
                    <FileUp className="w-8 h-8" />
                  </div>
                  <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition">
                    Excel Dosyası Seçin veya Sürükleyip Bırakın
                  </span>
                  <span className="text-xs text-slate-400 mt-1">.xlsx, .xls veya .csv (Maksimum 5 MB)</span>
                </label>
              ) : (
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">{importFile.name}</span>
                      <span className="text-[11px] text-slate-400 block">
                        {(importFile.size / 1024).toFixed(1)} KB • {parsedImportRows.length} satır okundu
                      </span>
                    </div>
                  </div>
                  <label className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition cursor-pointer">
                    Değiştir
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Yükleme / Ayrıştırma Durumu */}
              {isParsingImport && (
                <div className="flex items-center justify-center py-6 gap-2 text-indigo-400 text-xs font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Excel dosyası ayrıştırılıyor...</span>
                </div>
              )}

              {/* Önizleme & İstatistikler */}
              {parsedImportRows.length > 0 && (
                <div className="space-y-3">
                  {/* Özet Rozetleri */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5">
                      <span className="text-[11px] text-slate-400 block font-medium">Toplam Kayıt</span>
                      <span className="text-lg font-bold text-white font-mono">{importSummary.total}</span>
                    </div>
                    <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-2.5">
                      <span className="text-[11px] text-emerald-400 block font-medium">Geçerli Varlıklar</span>
                      <span className="text-lg font-bold text-emerald-400 font-mono">{importSummary.valid}</span>
                    </div>
                    <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-2.5">
                      <span className="text-[11px] text-amber-400 block font-medium">Aktif / Satılan</span>
                      <span className="text-sm font-bold text-amber-300 font-mono mt-0.5 block">
                        {importSummary.active} Aktif • {importSummary.sold} Satıldı
                      </span>
                    </div>
                    <div className={`rounded-xl p-2.5 border ${importSummary.invalid > 0 ? 'bg-red-950/30 border-red-500/30' : 'bg-slate-800/80 border-slate-700/60'}`}>
                      <span className={`text-[11px] block font-medium ${importSummary.invalid > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        Hatalı Satırlar
                      </span>
                      <span className={`text-lg font-bold font-mono ${importSummary.invalid > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {importSummary.invalid}
                      </span>
                    </div>
                  </div>

                  {/* Önizleme Tablosu */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-800/90 text-slate-400 uppercase text-[10px] font-bold sticky top-0">
                          <tr>
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Durum</th>
                            <th className="py-2 px-3">Sembol</th>
                            <th className="py-2 px-3">Varlık Adı</th>
                            <th className="py-2 px-3">Tür</th>
                            <th className="py-2 px-3">Para</th>
                            <th className="py-2 px-3 text-right">Miktar</th>
                            <th className="py-2 px-3 text-right">Alış Fiyatı</th>
                            <th className="py-2 px-3 text-right">Satış Fiyatı</th>
                            <th className="py-2 px-3">Platform</th>
                            <th className="py-2 px-3">Doğrulama</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {parsedImportRows.map((row, idx) => (
                            <tr
                              key={idx}
                              className={`hover:bg-slate-800/40 transition ${
                                !row.isValid ? 'bg-red-950/20' : ''
                              }`}
                            >
                              <td className="py-2 px-3 text-slate-500 font-mono">{idx + 1}</td>
                              <td className="py-2 px-3">
                                {row.isActive ? (
                                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    Aktif
                                  </span>
                                ) : (
                                  <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    Satıldı
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-bold text-white font-mono">{row.symbol || '-'}</td>
                              <td className="py-2 px-3 text-slate-300 truncate max-w-[120px]">{row.name || '-'}</td>
                              <td className="py-2 px-3 text-slate-400">{ASSET_TYPE_NAMES[row.assetType as AssetType] || 'Hisse'}</td>
                              <td className="py-2 px-3 text-slate-400 font-mono">{CURRENCY_LABELS[row.currency as Currency] || 'TRY'}</td>
                              <td className="py-2 px-3 text-right font-mono text-white">{row.quantity || 0}</td>
                              <td className="py-2 px-3 text-right font-mono text-slate-300">
                                {row.purchasePrice?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-purple-300">
                                {!row.isActive && row.salePrice
                                  ? row.salePrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })
                                  : '-'}
                              </td>
                              <td className="py-2 px-3 text-slate-400 truncate max-w-[90px]">{row.platform || '-'}</td>
                              <td className="py-2 px-3">
                                {row.isValid ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Geçerli
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 text-red-400 text-[11px] font-semibold"
                                    title={row.validationError}
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" /> {row.validationError}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setParsedImportRows([]);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              >
                İptal
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={importSummary.valid === 0 || isExecutingImport}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExecutingImport ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Portföye Aktarılıyor...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>{importSummary.valid > 0 ? `${importSummary.valid} Adet Varlığı Aktar` : 'İçe Aktar'}</span>
                  </>
                )}
              </button>
            </div>
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
