'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/axios';
import { useAuthStore } from '@/store/auth-store';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { StrategyBasket, StrategyBasketItem } from '@/types/strategy-basket';
import { AssetType, Currency } from '@/types/finance';
import axios from 'axios';
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  Target,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  PieChart as PieIcon,
  ShoppingBag,
  Coins,
  ShieldCheck,
  CheckCircle2,
  X,
  Clock,
  DownloadCloud,
  ChevronDown,
  RefreshCw,
  FolderPlus,
} from 'lucide-react';

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
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

const PREDEFINED_SYMBOLS = [
  { symbol: 'THYAO', name: 'Türk Hava Yolları', type: AssetType.Stock, currency: Currency.TRY },
  { symbol: 'ENJSA', name: 'Enerjisa Enerji', type: AssetType.Stock, currency: Currency.TRY },
  { symbol: 'GARAN', name: 'Garanti BBVA', type: AssetType.Stock, currency: Currency.TRY },
  { symbol: 'ASELS', name: 'Aselsan', type: AssetType.Stock, currency: Currency.TRY },
  { symbol: 'TUPRS', name: 'Tüpraş', type: AssetType.Stock, currency: Currency.TRY },
  { symbol: 'KCHOL', name: 'Koç Holding', type: AssetType.Stock, currency: Currency.TRY },
  { symbol: 'NVDA', name: 'NVIDIA Corp', type: AssetType.Stock, currency: Currency.USD },
  { symbol: 'AAPL', name: 'Apple Inc', type: AssetType.Stock, currency: Currency.USD },
  { symbol: 'NLR', name: 'VanEck Uranium ETF', type: AssetType.ETF, currency: Currency.USD },
  { symbol: 'BTC', name: 'Bitcoin', type: AssetType.Crypto, currency: Currency.USD },
  { symbol: 'ETH', name: 'Ethereum', type: AssetType.Crypto, currency: Currency.USD },
  { symbol: 'SOL', name: 'Solana', type: AssetType.Crypto, currency: Currency.USD },
  { symbol: 'GRAM ALTIN', name: 'Gram Altın (Spot)', type: AssetType.Commodity, currency: Currency.TRY },
  { symbol: 'CEYREK ALTIN', name: 'Çeyrek Altın', type: AssetType.Commodity, currency: Currency.TRY },
  { symbol: 'TAM ALTIN', name: 'Tam Altın', type: AssetType.Commodity, currency: Currency.TRY },
  { symbol: 'CUMHURIYET ALTINI', name: 'Cumhuriyet Altını', type: AssetType.Commodity, currency: Currency.TRY },
  { symbol: 'ONS ALTIN', name: 'Altın (ONS $)', type: AssetType.Commodity, currency: Currency.USD },
  { symbol: '22 AYAR BILEZIK', name: '22 Ayar Bilezik', type: AssetType.Commodity, currency: Currency.TRY },
];

export default function StrategyBasketsPage() {
  const isValuesHidden = useAuthStore((state) => state.isValuesHidden);
  const toast = useToast();

  const [baskets, setBaskets] = useState<StrategyBasket[]>([]);
  const [selectedBasketId, setSelectedBasketId] = useState<number | null>(null);
  const [usdRate, setUsdRate] = useState<number>(48.03);
  const [isLoading, setIsLoading] = useState(true);

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

  // Basket Modal State (Create / Edit)
  const [isBasketModalOpen, setIsBasketModalOpen] = useState(false);
  const [editingBasket, setEditingBasket] = useState<StrategyBasket | null>(null);
  const [basketName, setBasketName] = useState('');
  const [basketDesc, setBasketDesc] = useState('');
  const [basketTargetDate, setBasketTargetDate] = useState('');

  // Item Modal State (Add / Edit Line)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StrategyBasketItem | null>(null);
  const [itemSymbol, setItemSymbol] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemAssetType, setItemAssetType] = useState<AssetType>(AssetType.Stock);
  const [itemCurrency, setItemCurrency] = useState<Currency>(Currency.TRY);
  const [itemQuantity, setItemQuantity] = useState('');
  const [itemCurrentPrice, setItemCurrentPrice] = useState('');
  const [itemTargetPrice, setItemTargetPrice] = useState('');
  const [itemTargetProfitPercent, setItemTargetProfitPercent] = useState('');
  const [itemPlatform, setItemPlatform] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);

  // Fetch Baskets
  const fetchBaskets = async (selectId?: number) => {
    try {
      setIsLoading(true);
      const res = await api.get<StrategyBasket[]>(`/api/strategybaskets?usdRate=${usdRate}`);
      setBaskets(res.data);

      if (res.data.length > 0) {
        if (selectId && res.data.some((b) => b.id === selectId)) {
          setSelectedBasketId(selectId);
        } else if (!selectedBasketId || !res.data.some((b) => b.id === selectedBasketId)) {
          setSelectedBasketId(res.data[0].id);
        }
      } else {
        setSelectedBasketId(null);
      }
    } catch (err) {
      console.error('Failed to fetch strategy baskets', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Canlı USD kuru al
    axios
      .get('http://localhost:8000/api/prices/currency?base=USD&target=TRY', { timeout: 3000 })
      .then((r) => {
        if (r.data?.rate) setUsdRate(r.data.rate);
      })
      .catch(() => {});

    fetchBaskets();
  }, []);

  // Aktif Seçili Sepet
  const activeBasket = useMemo(() => {
    return baskets.find((b) => b.id === selectedBasketId) || null;
  }, [baskets, selectedBasketId]);

  // Konsolide Sepet İstatistikleri (0 ms Anlık Hesaplama)
  const basketStats = useMemo(() => {
    if (!activeBasket || !activeBasket.items || activeBasket.items.length === 0) {
      return {
        totalCostTRY: 0,
        totalTargetTRY: 0,
        totalProfitTRY: 0,
        profitPercentTRY: 0,
        totalCostUSD: 0,
        totalTargetUSD: 0,
        totalProfitUSD: 0,
        distribution: [] as Array<{ label: string; percent: number; color: string }>,
      };
    }

    const rate = usdRate > 0 ? usdRate : 48.03;
    let costTRY = 0;
    let targetTRY = 0;

    const typeSums: Record<AssetType, number> = {
      [AssetType.Stock]: 0,
      [AssetType.Crypto]: 0,
      [AssetType.Commodity]: 0,
      [AssetType.ETF]: 0,
      [AssetType.Bond]: 0,
    };

    activeBasket.items.forEach((it) => {
      let itCost = it.quantity * it.currentPrice;
      let itTarget = it.quantity * it.targetPrice;

      if (it.currency === Currency.USD) {
        itCost *= rate;
        itTarget *= rate;
      } else if (it.currency === Currency.EUR) {
        itCost *= (rate * 1.08);
        itTarget *= (rate * 1.08);
      }

      costTRY += itCost;
      targetTRY += itTarget;
      typeSums[it.assetType] = (typeSums[it.assetType] || 0) + itCost;
    });

    const profitTRY = targetTRY - costTRY;
    const profitPct = costTRY > 0 ? (profitTRY / costTRY) * 100 : 0;

    const typeColors: Record<AssetType, string> = {
      [AssetType.Stock]: '#6366f1',
      [AssetType.Crypto]: '#f59e0b',
      [AssetType.Commodity]: '#10b981',
      [AssetType.ETF]: '#8b5cf6',
      [AssetType.Bond]: '#ef4444',
    };

    const distribution = Object.entries(typeSums)
      .filter(([_, val]) => val > 0)
      .map(([typeStr, val]) => ({
        label: ASSET_TYPE_LABELS[Number(typeStr) as AssetType] || 'Varlık',
        percent: costTRY > 0 ? (val / costTRY) * 100 : 0,
        color: typeColors[Number(typeStr) as AssetType] || '#6366f1',
      }))
      .sort((a, b) => b.percent - a.percent);

    return {
      totalCostTRY: costTRY,
      totalTargetTRY: targetTRY,
      totalProfitTRY: profitTRY,
      profitPercentTRY: profitPct,
      totalCostUSD: rate > 0 ? costTRY / rate : 0,
      totalTargetUSD: rate > 0 ? targetTRY / rate : 0,
      totalProfitUSD: rate > 0 ? profitTRY / rate : 0,
      distribution,
    };
  }, [activeBasket, usdRate]);

  // Otomatik Canlı Fiyat Çekme (Scraper Entegrasyonu)
  const fetchLivePriceForSymbol = async (sym: string, type: AssetType) => {
    if (!sym || !sym.trim()) return;
    setIsFetchingPrice(true);
    const cleanSym = sym.toUpperCase().trim();

    try {
      const isCrypto =
        type === AssetType.Crypto ||
        ['BTC', 'ETH', 'SOL', 'AVAX', 'BNB', 'XRP', 'DOGE', 'HYPE', 'SYRUP'].some((k) => cleanSym.includes(k));

      if (isCrypto) {
        const isTry = itemCurrency === Currency.TRY || cleanSym.includes('/TL') || cleanSym.includes('/TRY');
        const vs = isTry ? 'try' : 'usd';
        const r = await axios.get(`http://localhost:8000/api/prices/crypto?symbol=${cleanSym}&vs=${vs}`, { timeout: 3500 });
        if (r.data?.price && r.data.price > 0) {
          setItemCurrentPrice(r.data.price.toString());
          toast.success(`${cleanSym} canlı fiyatı getirildi: ${r.data.price} ${isTry ? '₺' : '$'}`);
          recalcTargetPrice(r.data.price, itemTargetProfitPercent);
          return;
        }
      }

      if (type === AssetType.Commodity || ['ALTIN', 'GRAM', 'CEYREK', 'TAM', 'YARIM', 'CUMHURIYET', 'ONS', 'BILEZIK'].some((k) => cleanSym.includes(k))) {
        let goldType = 'gram-altin';
        if (cleanSym.includes('CEYREK')) goldType = 'ceyrek-altin';
        else if (cleanSym.includes('YARIM')) goldType = 'yarim-altin';
        else if (cleanSym.includes('TAM')) goldType = 'tam-altin';
        else if (cleanSym.includes('CUMHURIYET')) goldType = 'cumhuriyet-altini';
        else if (cleanSym.includes('ONS')) goldType = 'ons-altin';
        else if (cleanSym.includes('BILEZIK')) goldType = '22-ayar-bilezik';

        const r = await axios.get(`http://localhost:8000/api/prices/gold?type=${goldType}`, { timeout: 3500 });
        if (r.data?.price && r.data.price > 0) {
          setItemCurrentPrice(r.data.price.toString());
          setItemCurrency(goldType === 'ons-altin' ? Currency.USD : Currency.TRY);
          toast.success(`${cleanSym} canlı fiyatı getirildi: ${r.data.price} ₺`);
          recalcTargetPrice(r.data.price, itemTargetProfitPercent);
          return;
        }
      }

      // Stock / ETF
      const r = await axios.get(`http://localhost:8000/api/prices/stock?symbol=${cleanSym}`, { timeout: 3500 });
      if (r.data?.price && r.data.price > 0) {
        setItemCurrentPrice(r.data.price.toString());
        toast.success(`${cleanSym} canlı fiyatı getirildi: ${r.data.price}`);
        recalcTargetPrice(r.data.price, itemTargetProfitPercent);
      }
    } catch (e) {
      console.warn('Canlı fiyat çekilemedi:', e);
    } finally {
      setIsFetchingPrice(false);
    }
  };

  // Çift Yönlü Hesaplayıcı: Fiyat ve % Değişimi
  const handleTargetPriceChange = (valStr: string) => {
    setItemTargetPrice(valStr);
    const target = parseFloat(valStr);
    const cur = parseFloat(itemCurrentPrice);
    if (!isNaN(target) && !isNaN(cur) && cur > 0) {
      const pct = ((target - cur) / cur) * 100;
      setItemTargetProfitPercent(pct.toFixed(2));
    }
  };

  const handleProfitPercentChange = (valStr: string) => {
    setItemTargetProfitPercent(valStr);
    const pct = parseFloat(valStr);
    const cur = parseFloat(itemCurrentPrice);
    if (!isNaN(pct) && !isNaN(cur) && cur > 0) {
      const target = cur * (1 + pct / 100);
      setItemTargetPrice(target.toFixed(2));
    }
  };

  const recalcTargetPrice = (curPrice: number, currentPctStr: string) => {
    const pct = parseFloat(currentPctStr);
    if (!isNaN(pct) && curPrice > 0) {
      const target = curPrice * (1 + pct / 100);
      setItemTargetPrice(target.toFixed(2));
    }
  };

  // Predefined Varlık Seçimi
  const handleSelectPredefined = (sym: string) => {
    const found = PREDEFINED_SYMBOLS.find((p) => p.symbol === sym);
    if (!found) return;

    setItemSymbol(found.symbol);
    setItemName(found.name);
    setItemAssetType(found.type);
    setItemCurrency(found.currency);
    fetchLivePriceForSymbol(found.symbol, found.type);
  };

  // Sepet Kaydet / Düzenle
  const handleSaveBasket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!basketName.trim()) return;

    try {
      if (editingBasket) {
        await api.put(`/api/strategybaskets/${editingBasket.id}`, {
          id: editingBasket.id,
          name: basketName.trim(),
          description: basketDesc.trim(),
          targetDate: basketTargetDate ? new Date(basketTargetDate).toISOString() : null,
          isArchived: editingBasket.isArchived,
        });
        toast.success('Strateji sepeti güncellendi.');
        await fetchBaskets(editingBasket.id);
      } else {
        const res = await api.post<StrategyBasket>('/api/strategybaskets', {
          name: basketName.trim(),
          description: basketDesc.trim(),
          targetDate: basketTargetDate ? new Date(basketTargetDate).toISOString() : null,
        });
        toast.success('Yeni strateji sepeti oluşturuldu.');
        await fetchBaskets(res.data.id);
      }
      setIsBasketModalOpen(false);
    } catch (err) {
      toast.error('Sepet kaydedilirken hata oluştu.');
    }
  };

  // Sepet Silme
  const handleDeleteBasketPrompt = (basket: StrategyBasket) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Strateji Sepetini Sil',
      message: `"${basket.name}" sepetini ve içindeki tüm planlanan varlıkları silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      onConfirm: async () => {
        try {
          await api.delete(`/api/strategybaskets/${basket.id}`);
          toast.success('Strateji sepeti silindi.');
          await fetchBaskets();
        } catch (err) {
          toast.error('Sepet silinirken hata oluştu.');
        } finally {
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Satır (Item) Kaydet
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBasketId || !itemSymbol.trim()) return;

    const qty = parseFloat(itemQuantity) || 0;
    const curP = parseFloat(itemCurrentPrice) || 0;
    const targetP = parseFloat(itemTargetPrice) || curP;
    const targetPct = parseFloat(itemTargetProfitPercent) || 0;

    try {
      await api.post(`/api/strategybaskets/${selectedBasketId}/items`, {
        id: editingItem ? editingItem.id : null,
        strategyBasketId: selectedBasketId,
        symbol: itemSymbol.toUpperCase().trim(),
        name: itemName.trim() || itemSymbol.toUpperCase().trim(),
        assetType: itemAssetType,
        currency: itemCurrency,
        quantity: qty,
        currentPrice: curP,
        targetPrice: targetP,
        targetProfitPercent: targetPct,
        platform: itemPlatform.trim(),
        notes: itemNotes.trim(),
      });

      toast.success(editingItem ? 'Varlık güncellendi.' : 'Yeni varlık sepete eklendi.');
      setIsItemModalOpen(false);
      await fetchBaskets(selectedBasketId);
    } catch (err) {
      toast.error('Varlık sepete kaydedilemedi.');
    }
  };

  // Satır Silme
  const handleDeleteItem = async (itemId: number, sym: string) => {
    try {
      await api.delete(`/api/strategybaskets/items/${itemId}`);
      toast.success(`${sym} sepetten kaldırıldı.`);
      await fetchBaskets(selectedBasketId || undefined);
    } catch (err) {
      toast.error('Varlık sepetten silinemedi.');
    }
  };

  // Tek Tıkla Gerçek Portföye Aktarma
  const handleApplyToPortfolioPrompt = () => {
    if (!activeBasket || !activeBasket.items || activeBasket.items.length === 0) {
      toast.warning('Sepette aktarılacak varlık bulunmuyor.');
      return;
    }

    setConfirmModalState({
      isOpen: true,
      title: 'Sepeti Gerçek Portföye Aktar',
      message: `"${activeBasket.name}" sepetindeki ${activeBasket.items.length} adet varlığın tamamı güncel alış fiyatlarıyla gerçek "Portföyüm" sayfasına eklenecektir. Onaylıyor musunuz?`,
      onConfirm: async () => {
        try {
          const res = await api.post(`/api/strategybaskets/${activeBasket.id}/apply-to-portfolio`);
          toast.success(`${res.data?.addedCount || activeBasket.items.length} adet varlık başarıyla Portföyüm sayfasına aktarıldı!`);
        } catch (err) {
          toast.error('Portföye aktarılırken hata oluştu.');
        } finally {
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const openNewBasketModal = () => {
    setEditingBasket(null);
    setBasketName('');
    setBasketDesc('');
    setBasketTargetDate('');
    setIsBasketModalOpen(true);
  };

  const openEditBasketModal = (b: StrategyBasket) => {
    setEditingBasket(b);
    setBasketName(b.name);
    setBasketDesc(b.description || '');
    setBasketTargetDate(b.targetDate ? b.targetDate.split('T')[0] : '');
    setIsBasketModalOpen(true);
  };

  const openNewItemModal = () => {
    setEditingItem(null);
    setItemSymbol('');
    setItemName('');
    setItemAssetType(AssetType.Stock);
    setItemCurrency(Currency.TRY);
    setItemQuantity('');
    setItemCurrentPrice('');
    setItemTargetPrice('');
    setItemTargetProfitPercent('25');
    setItemPlatform('');
    setItemNotes('');
    setIsItemModalOpen(true);
  };

  const openEditItemModal = (it: StrategyBasketItem) => {
    setEditingItem(it);
    setItemSymbol(it.symbol);
    setItemName(it.name);
    setItemAssetType(it.assetType);
    setItemCurrency(it.currency);
    setItemQuantity(it.quantity.toString());
    setItemCurrentPrice(it.currentPrice.toString());
    setItemTargetPrice(it.targetPrice.toString());
    setItemTargetProfitPercent(it.targetProfitPercent.toString());
    setItemPlatform(it.platform || '');
    setItemNotes(it.notes || '');
    setIsItemModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <Header
        title="Strateji & Yatırım Sepetleri"
        description="Farklı senaryo ve hedefler için yatırım sepetleri tasarlayın, canlı fiyatlarla getiri potansiyelini simüle edin"
        actions={
          <button
            onClick={openNewBasketModal}
            className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Yeni Sepet Aç</span>
          </button>
        }
      />

      {/* 1. SEPET SEÇİCİ TABS & ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-2 rounded-2xl shadow-xl">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto max-w-full">
          {baskets.map((b) => {
            const isSelected = b.id === selectedBasketId;
            return (
              <button
                key={b.id}
                onClick={() => setSelectedBasketId(b.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{b.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {b.items?.length || 0}
                </span>
              </button>
            );
          })}

          {baskets.length === 0 && !isLoading && (
            <p className="text-xs text-slate-500 px-3 py-1">Kayıtlı strateji sepeti bulunmuyor. Yeni bir sepet açarak başlayın.</p>
          )}
        </div>

        {activeBasket && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => openEditBasketModal(activeBasket)}
              className="p-2 text-slate-400 hover:text-white bg-slate-950/60 hover:bg-slate-800 border border-slate-800 rounded-xl transition cursor-pointer"
              title="Sepet Bilgilerini Düzenle"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDeleteBasketPrompt(activeBasket)}
              className="p-2 text-slate-400 hover:text-red-400 bg-slate-950/60 hover:bg-red-500/10 border border-slate-800 rounded-xl transition cursor-pointer"
              title="Sepeti Sil"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleApplyToPortfolioPrompt}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
              title="Bu sepetteki varlıkları tek tıkla gerçek portföyünüze ekler"
            >
              <DownloadCloud className="w-4 h-4" />
              <span className="hidden sm:inline">Portföyüme Aktar</span>
            </button>
          </div>
        )}
      </div>

      {activeBasket ? (
        <>
          {/* 2. CANLI KONSOLİDE KPI KARTLARI (0 ms REAKTİF) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Gereken Toplam Sermaye */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl group hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Gereken Toplam Sermaye</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                <MoneyAmount amount={basketStats.totalCostTRY} className="text-2xl" />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block font-mono">
                ~${basketStats.totalCostUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </div>

            {/* Hedeflenen Nihai Değer */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl group hover:border-purple-500/30 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Hedeflenen Nihai Değer</span>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Target className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-purple-300 mt-2">
                <MoneyAmount amount={basketStats.totalTargetTRY} className="text-2xl text-purple-300" />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block font-mono">
                ~${basketStats.totalTargetUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </div>

            {/* Beklenen Toplam Net Kâr */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl group hover:border-emerald-500/30 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Beklenen Toplam Net Kâr</span>
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                    basketStats.totalProfitTRY >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold mt-2">
                <MoneyAmount
                  amount={basketStats.totalProfitTRY}
                  showSign
                  highlightProfitLoss
                  className="text-2xl"
                />
              </div>
              <span className={`text-[11px] font-semibold mt-1 block ${basketStats.profitPercentTRY >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {basketStats.profitPercentTRY >= 0 ? '+' : ''}%{basketStats.profitPercentTRY.toFixed(2)} Potansiyel Getiri
              </span>
            </div>

            {/* Sepet Varlık Dağılım Çubuğu */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Sepet Dağılımı</span>
                <PieIcon className="w-4 h-4 text-indigo-400" />
              </div>

              {basketStats.distribution.length > 0 ? (
                <div className="space-y-2 mt-2">
                  {/* Multi-color Progress Bar */}
                  <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden flex shadow-inner">
                    {basketStats.distribution.map((d, i) => (
                      <div
                        key={i}
                        style={{ width: `${d.percent}%`, backgroundColor: d.color }}
                        title={`${d.label}: %${d.percent.toFixed(1)}`}
                      />
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                    {basketStats.distribution.map((d, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                        <span>{d.label} (%{d.percent.toFixed(0)})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-2">Varlık eklendikçe dağılım oluşacaktır.</p>
              )}
            </div>
          </div>

          {/* 3. DİNAMİK SEPET SATIRLARI TABLOSU */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Sepet Varlık & Hedef Tablosu</span>
                </h3>
                {activeBasket.description && (
                  <p className="text-xs text-slate-400 mt-0.5">{activeBasket.description}</p>
                )}
              </div>

              <button
                onClick={openNewItemModal}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-md transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Varlık / Hedef Ekle</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-3.5">Sembol / Varlık</th>
                    <th className="py-3 px-3">Tür</th>
                    <th className="py-3 px-3">Döviz</th>
                    <th className="py-3 px-3 text-right">Alınacak Adet</th>
                    <th className="py-3 px-3 text-right">Anlık Fiyat (Canlı)</th>
                    <th className="py-3 px-3 text-right">Gereken Sermaye</th>
                    <th className="py-3 px-3 text-right">Hedef Fiyat</th>
                    <th className="py-3 px-3 text-right">Hedeflenen Değer</th>
                    <th className="py-3 px-3 text-right">Beklenen Kâr</th>
                    <th className="py-3 px-3 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {activeBasket.items && activeBasket.items.length > 0 ? (
                    activeBasket.items.map((it) => {
                      const sym = CURRENCY_SYMBOLS[it.currency] || '₺';
                      const isProfit = it.targetProfitLoss >= 0;
                      const isCrypto = it.assetType === AssetType.Crypto;

                      return (
                        <tr key={it.id} className="hover:bg-slate-800/40 transition group">
                          <td className="py-2.5 px-3.5">
                            <span className="font-bold text-white block">{it.symbol}</span>
                            <span className="text-[11px] text-slate-500 truncate">{it.name}</span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md font-medium">
                              {ASSET_TYPE_LABELS[it.assetType] || 'Varlık'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-400 whitespace-nowrap">
                            {sym}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-200 whitespace-nowrap font-bold">
                            {it.quantity.toLocaleString('tr-TR', {
                              maximumFractionDigits: isCrypto ? 6 : 2,
                              minimumFractionDigits: isCrypto ? 2 : 0,
                            })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                            {it.currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {sym}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-white font-bold whitespace-nowrap">
                            {isValuesHidden ? '***' : `${it.requiredCapital.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${sym}`}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-purple-300 font-bold whitespace-nowrap">
                            <div>
                              <span>{it.targetPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {sym}</span>
                              <span className="text-[10px] text-emerald-400 block font-normal">
                                (+%{it.targetProfitPercent.toFixed(1)})
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-purple-200 font-bold whitespace-nowrap">
                            {isValuesHidden ? '***' : `${it.targetValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${sym}`}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isValuesHidden ? (
                              '***'
                            ) : (
                              <div>
                                <span>
                                  {isProfit ? '+' : ''}
                                  {it.targetProfitLoss.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {sym}
                                </span>
                                <span className="text-[10px] block opacity-80 font-normal">
                                  ({isProfit ? '+' : ''}
                                  {it.calculatedProfitPercent.toFixed(2)}%)
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEditItemModal(it)}
                                className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                title="Düzenle"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(it.id, it.symbol)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
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
                      <td colSpan={10} className="text-center py-12 text-slate-500 text-xs">
                        Bu sepette henüz eklenmiş bir varlık veya hedef bulunmuyor. Yukarıdaki <strong>"+ Varlık / Hedef Ekle"</strong> butonuna tıklayarak ilk stratejinizi oluşturun.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-4">
          <ShoppingBag className="w-12 h-12 text-indigo-400 mx-auto opacity-60" />
          <h3 className="text-base font-bold text-white">Strateji Sepeti Bulunmuyor</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Hisse, kripto, altın veya fonlardan oluşan yatırım hedeflerinizi simüle etmek için yeni bir sepet oluşturun.
          </p>
          <button
            onClick={openNewBasketModal}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>İlk Sepetini Aç</span>
          </button>
        </div>
      )}

      {/* CREATE / EDIT BASKET MODAL */}
      {isBasketModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-indigo-400" />
                <span>{editingBasket ? 'Sepeti Düzenle' : 'Yeni Strateji Sepeti'}</span>
              </h3>
              <button onClick={() => setIsBasketModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBasket} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Sepet Adı
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: 2026 Teknoloji Rallisi, BIST Temettü"
                  value={basketName}
                  onChange={(e) => setBasketName(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Açıklama / Strateji Notu
                </label>
                <textarea
                  rows={2}
                  placeholder="Bu sepetin ana hedefi ve vadeleri..."
                  value={basketDesc}
                  onChange={(e) => setBasketDesc(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Hedef Vade Tarihi (Opsiyonel)
                </label>
                <input
                  type="date"
                  value={basketTargetDate}
                  onChange={(e) => setBasketTargetDate(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBasketModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition cursor-pointer"
                >
                  {editingBasket ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT ITEM MODAL (CANLI FİYAT & ÇİFT YÖNLÜ HESAPLAYICI) */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-400" />
                  <span>{editingItem ? 'Varlığı Düzenle' : 'Sepete Varlık & Hedef Ekle'}</span>
                </h3>
                <p className="text-xs text-slate-400">Canlı fiyat otomatik çekilir, hedef fiyat veya % getiri girebilirsiniz</p>
              </div>
              <button onClick={() => setIsItemModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              {/* 1. Hızlı Varlık Seçimi */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Popüler Varlıklardan Hızlı Seç
                </label>
                <select
                  onChange={(e) => handleSelectPredefined(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  defaultValue=""
                >
                  <option value="" disabled>
                    -- Listeden Seçin (Canlı Fiyatı Otomatik Dolar) --
                  </option>
                  {PREDEFINED_SYMBOLS.map((p, idx) => (
                    <option key={idx} value={p.symbol}>
                      {p.symbol} - {p.name} ({ASSET_TYPE_LABELS[p.type]})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Sembol ve Tür */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Sembol / Kod
                    </label>
                    <button
                      type="button"
                      onClick={() => fetchLivePriceForSymbol(itemSymbol, itemAssetType)}
                      disabled={isFetchingPrice || !itemSymbol.trim()}
                      className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isFetchingPrice ? 'animate-spin' : ''}`} />
                      <span>Fiyat Çek</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="ENJSA, BTC, GRAM ALTIN"
                    value={itemSymbol}
                    onChange={(e) => setItemSymbol(e.target.value.toUpperCase())}
                    onBlur={() => fetchLivePriceForSymbol(itemSymbol, itemAssetType)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Varlık Türü
                  </label>
                  <select
                    value={itemAssetType}
                    onChange={(e) => setItemAssetType(Number(e.target.value))}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={AssetType.Stock}>Hisse Senedi</option>
                    <option value={AssetType.Crypto}>Kripto Para</option>
                    <option value={AssetType.Commodity}>Altın & Emtia</option>
                    <option value={AssetType.ETF}>Yatırım Fonu (ETF)</option>
                    <option value={AssetType.Bond}>Tahvil & Bono</option>
                  </select>
                </div>
              </div>

              {/* 3. Varlık Adı ve Para Birimi */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Varlık Adı
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Enerjisa Enerji"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Para Birimi
                  </label>
                  <select
                    value={itemCurrency}
                    onChange={(e) => setItemCurrency(Number(e.target.value))}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-indigo-400 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={Currency.TRY}>₺ Türk Lirası (TRY)</option>
                    <option value={Currency.USD}>$ Amerikan Doları (USD)</option>
                    <option value={Currency.EUR}>€ Euro (EUR)</option>
                  </select>
                </div>
              </div>

              {/* 4. Alınacak Adet ve Güncel Canlı Fiyat */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Alınacak Adet / Miktar
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="100 veya 0.05"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Anlık Fiyat ({CURRENCY_SYMBOLS[itemCurrency]})
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="118.00"
                    value={itemCurrentPrice}
                    onChange={(e) => {
                      setItemCurrentPrice(e.target.value);
                      recalcTargetPrice(parseFloat(e.target.value) || 0, itemTargetProfitPercent);
                    }}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 5. ÇİFT YÖNLÜ HEDEF HESAPLAYICI (Hedef Fiyat ⟷ % Getiri) */}
              <div className="bg-slate-950/80 border border-indigo-500/30 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Çift Yönlü Hedef Simülasyonu</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Hedef Fiyat ({CURRENCY_SYMBOLS[itemCurrency]})
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="165.00"
                      value={itemTargetPrice}
                      onChange={(e) => handleTargetPriceChange(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-purple-300 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Beklenen Getiri (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        placeholder="35"
                        value={itemTargetProfitPercent}
                        onChange={(e) => handleProfitPercentChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-emerald-400 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="absolute right-3 top-2 text-slate-500 font-bold text-xs">%</span>
                    </div>
                  </div>
                </div>

                {/* Canlı Önizleme */}
                {parseFloat(itemQuantity) > 0 && parseFloat(itemCurrentPrice) > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">
                      Maliyet: {((parseFloat(itemQuantity) || 0) * (parseFloat(itemCurrentPrice) || 0)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {CURRENCY_SYMBOLS[itemCurrency]}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      Hedef: {((parseFloat(itemQuantity) || 0) * (parseFloat(itemTargetPrice) || 0)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {CURRENCY_SYMBOLS[itemCurrency]}
                    </span>
                  </div>
                )}
              </div>

              {/* 6. Kurum / Not */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Planlanan Kurum / Platform
                  </label>
                  <input
                    type="text"
                    placeholder="Midas, Midas Kripto, Yapı Kredi, Ziraat Yatırım"
                    value={itemPlatform}
                    onChange={(e) => setItemPlatform(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Strateji Notu
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: 2. çeyrek bilançosuna kadar tutulacak"
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition cursor-pointer"
                >
                  {editingItem ? 'Güncelle' : 'Sepete Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Confirm Modal */}
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
