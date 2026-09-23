'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Header } from '@/components/layout/Header';
import { api, SCRAPER_BASE_URL } from '@/lib/axios';
import { useAuthStore } from '@/store/auth-store';
import { formatShortDateTime } from '@/lib/date-utils';
import axios from 'axios';
import {
  TrendingUp,
  Coins,
  DollarSign,
  RefreshCw,
  Loader2,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  CheckCircle2,
  Clock,
  Globe,
  Fuel,
  Percent,
  Sparkles,
  Gauge,
  Landmark,
  SlidersHorizontal,
  Plus,
  Trash2,
  RotateCcw,
  X,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Check,
} from 'lucide-react';

// Seans Durumu Yardımcısı (TSİ UTC+3 Saatlerine Göre)
function getMarketSessionStatus(type: 'US' | 'BIST'): { isOpen: boolean; label: string } {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const tsi = new Date(utc + 3600000 * 3); // TSİ (UTC+3)
  const day = tsi.getDay(); // 0: Pazar, 6: Cumartesi
  const isWeekday = day >= 1 && day <= 5;
  const timeInMinutes = tsi.getHours() * 60 + tsi.getMinutes();

  if (type === 'US') {
    // ABD Piyasaları TSİ 16:30 (990 dk) - 23:00 (1380 dk)
    const isOpen = isWeekday && timeInMinutes >= 990 && timeInMinutes < 1380;
    return {
      isOpen,
      label: isOpen ? 'AÇIK' : 'KAPALI',
    };
  } else {
    // BIST 100 TSİ 10:00 (600 dk) - 18:00 (1080 dk)
    const isOpen = isWeekday && timeInMinutes >= 600 && timeInMinutes < 1080;
    return {
      isOpen,
      label: isOpen ? 'AÇIK' : 'KAPALI',
    };
  }
}

// Değişim Rozeti (Pozitif: ▲ Yeşil, Negatif: ▼ Kırmızı, Nötr / Kapalı: ● Nötr Gri)
function ChangeBadge({ change, className = '' }: { change?: number | null; className?: string }) {
  if (change === undefined || change === null || isNaN(change)) return null;
  const isZero = Math.abs(change) < 0.005;
  const isPositive = change > 0.005;
  const formatted = Math.abs(change).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (isZero) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono font-medium border transition-colors shrink-0 bg-slate-800/80 text-slate-400 border-slate-700/60 ${className}`}
        title="Fiyat Değişmedi (Nötr / Kapanış Seviyesi)"
      >
        <span className="text-[8px] leading-none text-slate-500">●</span>
        <span>0,00%</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold border transition-colors shrink-0 ${
        isPositive
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
      } ${className}`}
    >
      <span className="text-[9px] leading-none">{isPositive ? '▲' : '▼'}</span>
      <span>{formatted}%</span>
    </span>
  );
}

const INITIAL_STOCKS = [
  { symbol: 'THYAO', name: 'Türk Hava Yolları', price: 296.00, change: 1.54 },
  { symbol: 'GARAN', name: 'Garanti BBVA', price: 131.90, change: -0.45 },
  { symbol: 'AKBNK', name: 'Akbank', price: 71.70, change: 0.98 },
  { symbol: 'ASELS', name: 'Aselsan', price: 409.00, change: 2.45 },
  { symbol: 'SISE', name: 'Şişecam', price: 39.86, change: -0.15 },
  { symbol: 'EREGL', name: 'Ereğli Demir Çelik', price: 38.44, change: 0.35 },
  { symbol: 'TUPRS', name: 'Tüpraş', price: 404.25, change: 1.12 },
  { symbol: 'KCHOL', name: 'Koç Holding', price: 220.80, change: -0.80 },
];

const INITIAL_GOLDS = [
  { type: 'gram-altin', label: 'Gram Altın (Spot TL/GR)', price: 6898.85, change: -0.74 },
  { type: 'gumus', label: 'Gram Gümüş (Spot TL/GR)', price: 103.13, change: -0.97 },
  { type: 'ceyrek-altin', label: 'Çeyrek Altın', price: 11246.00, change: -1.11 },
  { type: 'yarim-altin', label: 'Yarım Altın', price: 22464.00, change: -1.11 },
  { type: 'tam-altin', label: 'Tam Altın', price: 44526.08, change: -1.14 },
  { type: 'cumhuriyet-altini', label: 'Cumhuriyet Altını', price: 44776.00, change: -1.11 },
  { type: 'ons-altin', label: 'Altın (ONS $)', price: 4430.19, change: -0.96 },
  { type: '22-ayar-bilezik', label: '22 Ayar Bilezik', price: 6442.44, change: -1.11 },
];

const INITIAL_CRYPTOS = [
  { symbol: 'BTC', name: 'Bitcoin', price: 79792.42, change: -2.65 },
  { symbol: 'ETH', name: 'Ethereum', price: 2454.76, change: -2.45 },
  { symbol: 'SOL', name: 'Solana', price: 101.76, change: -3.42 },
  { symbol: 'AVAX', name: 'Avalanche', price: 7.37, change: -2.36 },
  { symbol: 'BNB', name: 'Binance Coin', price: 718.33, change: -1.09 },
  { symbol: 'XRP', name: 'Ripple', price: 1.40, change: -4.79 },
  { symbol: 'AAVE', name: 'Aave', price: 130.24, change: -3.46 },
  { symbol: 'HYPE', name: 'Hyperliquid', price: 84.20, change: -1.28 },
  { symbol: 'RAIL', name: 'Railgun', price: 1.96, change: -2.68 },
  { symbol: 'SYRUP', name: 'Syrup', price: 0.22, change: 2.39 },
];

const INITIAL_US_STOCKS = [
  { symbol: 'NVDA', querySym: 'NVDA', name: 'Nvidia Corp.', price: 230.36, change: 0.84 },
  { symbol: 'AAPL', querySym: 'AAPL', name: 'Apple Inc.', price: 319.97, change: -2.51 },
  { symbol: 'MSFT', querySym: 'MSFT', name: 'Microsoft Corp.', price: 499.70, change: -2.04 },
  { symbol: 'TSLA', querySym: 'TSLA', name: 'Tesla Inc.', price: 354.08, change: -5.92 },
  { symbol: 'AMZN', querySym: 'AMZN', name: 'Amazon.com Inc.', price: 258.51, change: -0.15 },
  { symbol: 'GOOGL', querySym: 'GOOGL', name: 'Alphabet Class A', price: 338.46, change: -1.11 },
  { symbol: 'META', querySym: 'META', name: 'Meta Platforms', price: 616.77, change: 1.00 },
  { symbol: 'NFLX', querySym: 'NFLX', name: 'Netflix Inc.', price: 78.25, change: -5.35 },
];

const INITIAL_INDICES = {
  XU100: { symbol: 'XU100', name: 'BIST 100', price: null, change: null },
  SP500: { symbol: '^GSPC', name: 'S&P 500', price: null, change: null },
  NASDAQ: { symbol: '^IXIC', name: 'NASDAQ', price: null, change: null },
  sectors: {
    XBANK: { symbol: 'XBANK', name: 'Banka', price: null, change: null },
    XHOLD: { symbol: 'XHOLD', name: 'Holding', price: null, change: null },
    XUSIN: { symbol: 'XUSIN', name: 'Sınai', price: null, change: null },
    XULAS: { symbol: 'XULAS', name: 'Ulaştırma', price: null, change: null },
    XGMYO: { symbol: 'XGMYO', name: 'GYO', price: null, change: null },
  },
};

const INITIAL_COMMODITIES = {
  brent: { symbol: 'BZ=F', name: 'Brent Petrol', price: null, change: null, currency: 'USD' },
  crude: { symbol: 'CL=F', name: 'Ham Petrol (WTI)', price: null, change: null, currency: 'USD' },
  gold: { symbol: 'GC=F', name: 'XAU / USD', price: null, change: null, currency: 'USD' },
  silver: { symbol: 'SI=F', name: 'XAG / USD', price: null, change: null, currency: 'USD' },
  vix: { symbol: '^VIX', name: 'VIX (Korku Endeksi)', price: null, change: null, currency: 'USD' },
};

const INITIAL_BONDS = {
  us10y: { symbol: '^TNX', name: 'US10Y', price: null, change: null, currency: 'USD' },
  us2y: { symbol: '2YY=F', name: 'US2Y', price: null, change: null, currency: 'USD' },
};

const INITIAL_CENTRAL_BANKS = {
  TCMB: { name: 'TCMB', fullName: 'Türkiye Cumhuriyet Merkez Bankası', rate: 37.00, rateFormatted: '37,00%', nextMeeting: '10.09.2026', lastChange: '22.01.2026 (-100bp)', flag: '🇹🇷' },
  FED: { name: 'FED', fullName: 'Federal Rezerv', rate: 3.75, rateFormatted: '3,75%', nextMeeting: '16.09.2026', lastChange: '10.12.2025 (-25bp)', flag: '🇺🇸' },
  ECB: { name: 'ECB', fullName: 'Avrupa Merkez Bankası', rate: 2.40, rateFormatted: '2,40%', nextMeeting: '10.09.2026', lastChange: '11.06.2026 (25bp)', flag: '🇪🇺' },
};

const INITIAL_CRYPTO_SENTIMENT = {
  fng: { score: 74, classification: 'Greed', classificationTr: 'Açgözlülük' },
  altcoinSeason: { score: 33, season: 'Bitcoin Season', seasonTr: 'BTC Sezonu' },
  btcDominance: { dominance: 59.22, change: 0.15 },
};

export type WatchlistCategory = 'bist' | 'gold' | 'crypto' | 'us';

export interface WatchlistStockItem {
  symbol: string;
  name: string;
}

export interface WatchlistGoldItem {
  type: string;
  label: string;
}

export interface WatchlistCryptoItem {
  symbol: string;
  name: string;
}

export interface WatchlistUsItem {
  symbol: string;
  name: string;
  querySym?: string;
}

export interface WatchlistConfig {
  bist: WatchlistStockItem[];
  gold: WatchlistGoldItem[];
  crypto: WatchlistCryptoItem[];
  us: WatchlistUsItem[];
}

export const DEFAULT_WATCHLIST_CONFIG: WatchlistConfig = {
  bist: [
    { symbol: 'THYAO', name: 'Türk Hava Yolları' },
    { symbol: 'GARAN', name: 'Garanti BBVA' },
    { symbol: 'AKBNK', name: 'Akbank' },
    { symbol: 'ASELS', name: 'Aselsan' },
    { symbol: 'SISE', name: 'Şişecam' },
    { symbol: 'EREGL', name: 'Ereğli Demir Çelik' },
    { symbol: 'TUPRS', name: 'Tüpraş' },
    { symbol: 'KCHOL', name: 'Koç Holding' },
  ],
  gold: [
    { type: 'gram-altin', label: 'Gram Altın (Spot TL/GR)' },
    { type: 'gumus', label: 'Gram Gümüş (Spot TL/GR)' },
    { type: 'ceyrek-altin', label: 'Çeyrek Altın' },
    { type: 'yarim-altin', label: 'Yarım Altın' },
    { type: 'tam-altin', label: 'Tam Altın' },
    { type: 'cumhuriyet-altini', label: 'Cumhuriyet Altını' },
    { type: 'ons-altin', label: 'Altın (ONS $)' },
    { type: '22-ayar-bilezik', label: '22 Ayar Bilezik' },
  ],
  crypto: [
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'SOL', name: 'Solana' },
    { symbol: 'AVAX', name: 'Avalanche' },
    { symbol: 'BNB', name: 'Binance Coin' },
    { symbol: 'XRP', name: 'Ripple' },
    { symbol: 'AAVE', name: 'Aave' },
    { symbol: 'HYPE', name: 'Hyperliquid' },
    { symbol: 'RAIL', name: 'Railgun' },
    { symbol: 'SYRUP', name: 'Syrup' },
  ],
  us: [
    { symbol: 'NVDA', name: 'Nvidia Corp.' },
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corp.' },
    { symbol: 'TSLA', name: 'Tesla Inc.' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.' },
    { symbol: 'GOOGL', name: 'Alphabet Class A' },
    { symbol: 'META', name: 'Meta Platforms' },
    { symbol: 'NFLX', name: 'Netflix Inc.' },
  ],
};

export const ALL_GOLD_PRESETS: WatchlistGoldItem[] = [
  { type: 'gram-altin', label: 'Gram Altın (Spot TL/GR)' },
  { type: 'gumus', label: 'Gram Gümüş (Spot TL/GR)' },
  { type: 'ceyrek-altin', label: 'Çeyrek Altın' },
  { type: 'yarim-altin', label: 'Yarım Altın' },
  { type: 'tam-altin', label: 'Tam Altın' },
  { type: 'cumhuriyet-altini', label: 'Cumhuriyet Altını' },
  { type: 'ons-altin', label: 'Altın (ONS $)' },
  { type: '22-ayar-bilezik', label: '22 Ayar Bilezik' },
  { type: 'ata-altin', label: 'Ata Altın' },
  { type: 'resat-altin', label: 'Reşat Altın' },
  { type: 'has-altin', label: 'Has Altın (Külçe)' },
  { type: '14-ayar-altin', label: '14 Ayar Altın' },
  { type: '18-ayar-altin', label: '18 Ayar Altın' },
];

export const POPULAR_SUGGESTIONS: Record<WatchlistCategory, { symbol?: string; type?: string; name?: string; label?: string }[]> = {
  bist: [
    { symbol: 'BIMAS', name: 'BİM Mağazalar' },
    { symbol: 'PETKM', name: 'Petkim' },
    { symbol: 'SAHOL', name: 'Sabancı Holding' },
    { symbol: 'TCELL', name: 'Turkcell' },
    { symbol: 'KRDMD', name: 'Kardemir D' },
    { symbol: 'FROTO', name: 'Ford Otosan' },
    { symbol: 'ISCTR', name: 'İş Bankası C' },
    { symbol: 'YKBNK', name: 'Yapı Kredi' },
    { symbol: 'PGSUS', name: 'Pegasus' },
    { symbol: 'ENKAI', name: 'Enka İnşaat' },
  ],
  gold: [
    { type: 'ata-altin', label: 'Ata Altın' },
    { type: 'resat-altin', label: 'Reşat Altın' },
    { type: 'has-altin', label: 'Has Altın (Külçe)' },
    { type: '14-ayar-altin', label: '14 Ayar Altın' },
    { type: '18-ayar-altin', label: '18 Ayar Altın' },
  ],
  crypto: [
    { symbol: 'DOGE', name: 'Dogecoin' },
    { symbol: 'ADA', name: 'Cardano' },
    { symbol: 'LINK', name: 'Chainlink' },
    { symbol: 'DOT', name: 'Polkadot' },
    { symbol: 'NEAR', name: 'Near Protocol' },
    { symbol: 'PEPE', name: 'Pepe' },
    { symbol: 'SUI', name: 'Sui' },
    { symbol: 'SHIB', name: 'Shiba Inu' },
    { symbol: 'LTC', name: 'Litecoin' },
    { symbol: 'UNI', name: 'Uniswap' },
  ],
  us: [
    { symbol: 'PLTR', name: 'Palantir Tech.' },
    { symbol: 'AMD', name: 'Advanced Micro Devices' },
    { symbol: 'INTC', name: 'Intel Corp.' },
    { symbol: 'COIN', name: 'Coinbase Global' },
    { symbol: 'DIS', name: 'Walt Disney' },
    { symbol: 'ARM', name: 'Arm Holdings' },
    { symbol: 'BABA', name: 'Alibaba Group' },
    { symbol: 'UBER', name: 'Uber Technologies' },
    { symbol: 'PYPL', name: 'PayPal' },
    { symbol: 'SMCI', name: 'Super Micro Computer' },
  ],
};

export default function MarketsPage() {
  const isValuesHidden = useAuthStore((state) => state.isValuesHidden);
  const user = useAuthStore((state) => state.user);
  const [bistStocks, setBistStocks] = useState<any[]>(INITIAL_STOCKS);
  const [usStocks, setUsStocks] = useState<any[]>(INITIAL_US_STOCKS);
  const [goldPrices, setGoldPrices] = useState<any[]>(INITIAL_GOLDS);
  const [cryptoPrices, setCryptoPrices] = useState<any[]>(INITIAL_CRYPTOS);
  const [indices, setIndices] = useState<any>(INITIAL_INDICES);
  const [commodities, setCommodities] = useState<any>(INITIAL_COMMODITIES);
  const [bonds, setBonds] = useState<any>(INITIAL_BONDS);
  const [centralBanks, setCentralBanks] = useState<any>(INITIAL_CENTRAL_BANKS);
  const [cryptoSentiment, setCryptoSentiment] = useState<any>(INITIAL_CRYPTO_SENTIMENT);
  const [currencyRates, setCurrencyRates] = useState<any>({
    USD: 48.82,
    EUR: 55.95,
    usdChange: 0.05,
    eurChange: -0.02,
    dxy: 99.16,
    dxyChange: 0.25,
  });
  const [lastSyncTime, setLastSyncTime] = useState<string>('Az önce');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // İzleme Listeleri State & Konfigürasyon
  const [watchlistConfig, setWatchlistConfig] = useState<WatchlistConfig>(DEFAULT_WATCHLIST_CONFIG);
  const watchlistConfigRef = useRef<WatchlistConfig>(DEFAULT_WATCHLIST_CONFIG);
  const bistStocksRef = useRef<any[]>(INITIAL_STOCKS);
  const usStocksRef = useRef<any[]>(INITIAL_US_STOCKS);
  const goldPricesRef = useRef<any[]>(INITIAL_GOLDS);
  const cryptoPricesRef = useRef<any[]>(INITIAL_CRYPTOS);
  const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false);
  const [activeWatchlistTab, setActiveWatchlistTab] = useState<WatchlistCategory>('bist');
  const [editingConfig, setEditingConfig] = useState<WatchlistConfig>(DEFAULT_WATCHLIST_CONFIG);
  const [newSymbolInput, setNewSymbolInput] = useState('');
  const [newNameInput, setNewNameInput] = useState('');
  const [modalInputError, setModalInputError] = useState('');

  // BIST Sektör Endeksleri Akordiyon State'i (Kompakt / Detaylı Mod)
  const [isBistSectorsExpanded, setIsBistSectorsExpanded] = useState<boolean>(false);

  useEffect(() => {
    try {
      const bistKey = user?.id ? `spendlog_${user.id}_bist_sectors_expanded` : 'spendlog_bist_sectors_expanded';
      let saved = localStorage.getItem(bistKey);
      if (saved === null && user?.id) {
        saved = localStorage.getItem('spendlog_bist_sectors_expanded');
      }
      if (saved !== null) {
        setIsBistSectorsExpanded(saved === 'true');
      }
    } catch (_) {}
  }, [user?.id]);

  // Stale closure önlemi için ref senkronizasyonu
  useEffect(() => {
    watchlistConfigRef.current = watchlistConfig;
  }, [watchlistConfig]);

  // Fiyatları ve Değişim Oranlarını Çekme (Önce /summary + missing lookup, Hata durumunda Fallback)
  const handleRefreshLiveMarkets = async (isBackground = false, overrideConfig?: WatchlistConfig) => {
    if (!isBackground) setIsRefreshing(true);
    const currentConfig = overrideConfig || watchlistConfigRef.current || watchlistConfig;
    try {
      const now = formatShortDateTime();

      // 1. Strateji: Tek ve Hızlı Özet Çağrısı (/api/prices/summary)
      try {
        const summaryRes = await axios.get(`${SCRAPER_BASE_URL}/api/prices/summary`, { timeout: 12000 });
        if (summaryRes.status === 200 && summaryRes.data) {
          const data = summaryRes.data;

          const bistRaw = data.bist || [];
          const bistList: any[] = Array.isArray(bistRaw) ? bistRaw : Object.values(bistRaw);
          const usRaw = data.us || [];
          const usList: any[] = Array.isArray(usRaw) ? usRaw : Object.values(usRaw);
          const goldRaw = data.gold || [];
          const goldList: any[] = Array.isArray(goldRaw) ? goldRaw : Object.values(goldRaw);
          const cryptoRaw = data.crypto || [];
          const cryptoList: any[] = Array.isArray(cryptoRaw) ? cryptoRaw : Object.values(cryptoRaw);

          const summaryBistMap = new Map<string, any>(bistList.map((s: any) => [s.symbol?.toUpperCase(), s]));
          const summaryUsMap = new Map<string, any>(usList.map((u: any) => [u.symbol?.toUpperCase(), u]));
          const summaryGoldMap = new Map<string, any>(goldList.map((g: any) => [g.type?.toLowerCase(), g]));
          const summaryCryptoMap = new Map<string, any>(cryptoList.map((c: any) => [c.symbol?.toUpperCase(), c]));

          // Özet servisinde yer almayan özel sembolleri tespit et
          const missingStockAndCryptoSymbols: string[] = [];
          currentConfig.bist.forEach((item) => {
            if (!summaryBistMap.has(item.symbol.toUpperCase())) {
              missingStockAndCryptoSymbols.push(item.symbol.toUpperCase());
            }
          });
          currentConfig.us.forEach((item) => {
            if (!summaryUsMap.has(item.symbol.toUpperCase())) {
              missingStockAndCryptoSymbols.push(item.symbol.toUpperCase());
            }
          });
          currentConfig.crypto.forEach((item) => {
            if (!summaryCryptoMap.has(item.symbol.toUpperCase())) {
              missingStockAndCryptoSymbols.push(item.symbol.toUpperCase());
            }
          });

          // Eksik sembolleri HybridMarketCache destekli portfolio-lookup ile 0-2 ms'de çek
          const extraLookupMap = new Map<string, any>();
          if (missingStockAndCryptoSymbols.length > 0) {
            try {
              const lookupRes = await axios.post(
                `${SCRAPER_BASE_URL}/api/prices/portfolio-lookup`,
                {
                  symbols: Array.from(new Set(missingStockAndCryptoSymbols)),
                  include_usd_rate: false,
                },
                { timeout: 8000 }
              );
              if (lookupRes.data?.prices) {
                lookupRes.data.prices.forEach((p: any) => {
                  if (p.symbol) extraLookupMap.set(p.symbol.toUpperCase(), p);
                });
              }
            } catch (lookupErr) {
              console.warn('Portfolio lookup for custom symbols failed:', lookupErr);
            }
          }

          // Eksik altın türlerini tekil çek
          const missingGoldTypes = currentConfig.gold.filter((g) => !summaryGoldMap.has(g.type.toLowerCase()));
          if (missingGoldTypes.length > 0) {
            await Promise.allSettled(
              missingGoldTypes.map(async (g) => {
                try {
                  const gRes = await axios.get(`${SCRAPER_BASE_URL}/api/prices/gold?type=${g.type}`, { timeout: 5000 });
                  if (gRes.data) {
                    summaryGoldMap.set(g.type.toLowerCase(), gRes.data);
                  }
                } catch {
                  // ignore
                }
              })
            );
          }

          // State'leri kullanıcının özelleştirdiği sıralama ve isimlerle senkron olarak güncelle
          const prevBistMap = new Map<string, any>(bistStocksRef.current.map((s: any) => [s.symbol?.toUpperCase(), s]));
          const updatedBist = currentConfig.bist.map((item) => {
            const sym = item.symbol.toUpperCase();
            const sc = summaryBistMap.get(sym) || extraLookupMap.get(sym);
            const pr = prevBistMap.get(sym);
            return {
              symbol: sym,
              name: item.name || sc?.name || pr?.name || sym,
              price: sc?.price ?? pr?.price ?? null,
              change: sc?.change ?? pr?.change ?? 0.0,
            };
          });
          bistStocksRef.current = updatedBist;
          setBistStocks(updatedBist);

          const prevUsMap = new Map<string, any>(usStocksRef.current.map((u: any) => [u.symbol?.toUpperCase(), u]));
          const updatedUs = currentConfig.us.map((item) => {
            const sym = item.symbol.toUpperCase();
            const sc = summaryUsMap.get(sym) || extraLookupMap.get(sym);
            const pr = prevUsMap.get(sym);
            return {
              symbol: sym,
              querySym: item.querySym || sym,
              name: item.name || sc?.name || pr?.name || sym,
              price: sc?.price ?? pr?.price ?? null,
              change: sc?.change ?? pr?.change ?? 0.0,
            };
          });
          usStocksRef.current = updatedUs;
          setUsStocks(updatedUs);

          const prevGoldMap = new Map<string, any>(goldPricesRef.current.map((g: any) => [g.type?.toLowerCase(), g]));
          const updatedGold = currentConfig.gold.map((item) => {
            const t = item.type.toLowerCase();
            const sc = summaryGoldMap.get(t);
            const pr = prevGoldMap.get(t);
            return {
              type: item.type,
              label: item.label || sc?.label || pr?.label || item.type,
              price: sc?.price ?? pr?.price ?? null,
              change: sc?.change ?? pr?.change ?? 0.0,
            };
          });
          goldPricesRef.current = updatedGold;
          setGoldPrices(updatedGold);

          const prevCryptoMap = new Map<string, any>(cryptoPricesRef.current.map((c: any) => [c.symbol?.toUpperCase(), c]));
          const updatedCrypto = currentConfig.crypto.map((item) => {
            const sym = item.symbol.toUpperCase();
            const sc = summaryCryptoMap.get(sym) || extraLookupMap.get(sym);
            const pr = prevCryptoMap.get(sym);
            return {
              symbol: sym,
              name: item.name || sc?.name || pr?.name || sym,
              price: sc?.price ?? pr?.price ?? null,
              change: sc?.change ?? pr?.change ?? 0.0,
            };
          });
          cryptoPricesRef.current = updatedCrypto;
          setCryptoPrices(updatedCrypto);

          let updatedRates = currencyRates;
          if (data.currency) {
            updatedRates = {
              USD: data.currency.USD?.rate || 48.82,
              EUR: data.currency.EUR?.rate || 55.95,
              usdChange: data.currency.USD?.change || 0.0,
              eurChange: data.currency.EUR?.change || 0.0,
              dxy: data.currency.DXY?.price || 99.16,
              dxyChange: data.currency.DXY?.change || 0.0,
            };
            setCurrencyRates(updatedRates);
          }

          // Endeksler: data.indices (doğrudan) ve data.bist (dict olarak) hibrit çözüm
          const rawIndices = data.indices || {};
          const bistObj = (!Array.isArray(data.bist) && typeof data.bist === 'object') ? (data.bist || {}) : {};

          const xu100Data = rawIndices.XU100 || bistObj.XU100 || summaryBistMap.get('XU100') || INITIAL_INDICES.XU100;
          const sp500Data = rawIndices.SP500 || INITIAL_INDICES.SP500;
          const nasdaqData = rawIndices.NASDAQ || INITIAL_INDICES.NASDAQ;

          const sectorsData = {
            XBANK: rawIndices.sectors?.XBANK || bistObj.XBANK || summaryBistMap.get('XBANK') || INITIAL_INDICES.sectors.XBANK,
            XHOLD: rawIndices.sectors?.XHOLD || bistObj.XHOLD || summaryBistMap.get('XHOLD') || INITIAL_INDICES.sectors.XHOLD,
            XUSIN: rawIndices.sectors?.XUSIN || bistObj.XUSIN || summaryBistMap.get('XUSIN') || INITIAL_INDICES.sectors.XUSIN,
            XULAS: rawIndices.sectors?.XULAS || bistObj.XULAS || summaryBistMap.get('XULAS') || INITIAL_INDICES.sectors.XULAS,
            XGMYO: rawIndices.sectors?.XGMYO || bistObj.XGMYO || summaryBistMap.get('XGMYO') || INITIAL_INDICES.sectors.XGMYO,
          };

          const updatedIndices = {
            XU100: xu100Data,
            SP500: sp500Data,
            NASDAQ: nasdaqData,
            sectors: sectorsData,
          };
          setIndices(updatedIndices);

          let updatedCommodities = commodities;
          if (data.commodities) {
            updatedCommodities = {
              brent: data.commodities.brent || INITIAL_COMMODITIES.brent,
              crude: data.commodities.crude || INITIAL_COMMODITIES.crude,
              gold: data.commodities.gold || INITIAL_COMMODITIES.gold,
              silver: data.commodities.silver || INITIAL_COMMODITIES.silver,
              vix: data.commodities.vix || INITIAL_COMMODITIES.vix,
            };
            setCommodities(updatedCommodities);
          }

          let updatedBonds = bonds;
          if (data.bonds) {
            updatedBonds = {
              us10y: data.bonds.us10y || INITIAL_BONDS.us10y,
              us2y: data.bonds.us2y || INITIAL_BONDS.us2y,
            };
            setBonds(updatedBonds);
          }

          let updatedCryptoSentiment = cryptoSentiment;
          if (data.crypto_sentiment) {
            const cs = data.crypto_sentiment;
            updatedCryptoSentiment = {
              fng: {
                score: cs.fng?.score ?? INITIAL_CRYPTO_SENTIMENT.fng.score,
                classification: cs.fng?.classification ?? INITIAL_CRYPTO_SENTIMENT.fng.classification,
                classificationTr: cs.fng?.classification_tr || cs.fng?.classificationTr || INITIAL_CRYPTO_SENTIMENT.fng.classificationTr,
              },
              altcoinSeason: {
                score: cs.altcoin_season?.score ?? cs.altcoinSeason?.score ?? INITIAL_CRYPTO_SENTIMENT.altcoinSeason.score,
                season: cs.altcoin_season?.season ?? cs.altcoinSeason?.season ?? INITIAL_CRYPTO_SENTIMENT.altcoinSeason.season,
                seasonTr: cs.altcoin_season?.season_tr || cs.altcoinSeason?.seasonTr || INITIAL_CRYPTO_SENTIMENT.altcoinSeason.seasonTr,
              },
              btcDominance: {
                dominance: cs.btc_dominance?.dominance ?? cs.btcDominance?.dominance ?? INITIAL_CRYPTO_SENTIMENT.btcDominance.dominance,
                change: cs.btc_dominance?.change ?? cs.btcDominance?.change ?? INITIAL_CRYPTO_SENTIMENT.btcDominance.change,
              },
            };
            setCryptoSentiment(updatedCryptoSentiment);
          }

          let updatedCentralBanks = centralBanks;
          if (data.central_banks) {
            updatedCentralBanks = {
              TCMB: data.central_banks.TCMB || INITIAL_CENTRAL_BANKS.TCMB,
              FED: data.central_banks.FED || INITIAL_CENTRAL_BANKS.FED,
              ECB: data.central_banks.ECB || INITIAL_CENTRAL_BANKS.ECB,
            };
            setCentralBanks(updatedCentralBanks);
          }

          setLastSyncTime(now);

          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('spendlog_market_cache');
              localStorage.setItem(
                'spendlog_market_cache_v3',
                JSON.stringify({
                  stocks: updatedBist,
                  usStocks: updatedUs,
                  golds: updatedGold,
                  cryptos: updatedCrypto,
                  rates: updatedRates,
                  indices: updatedIndices,
                  commodities: updatedCommodities,
                  bonds: updatedBonds,
                  cryptoSentiment: updatedCryptoSentiment,
                  centralBanks: updatedCentralBanks,
                  syncTime: now,
                })
              );
            } catch (_) {}
          }
          return;
        }
      } catch (sumErr) {
        console.warn('Summary endpoint unavailable, switching to parallel fetch...', sumErr);
      }

      // 2. Strateji: Bireysel Fallback Çağrıları
      const bistSymbols = currentConfig.bist.map((s) => s.symbol);
      const usSymbols = currentConfig.us.map((u) => u.symbol);
      const goldTypes = currentConfig.gold.map((g) => g.type);
      const cryptos = currentConfig.crypto.map((c) => c.symbol);

      const [stockResults, usResults, goldResults, cryptoResults, usdRate, eurRate, dxyRes, indicesRes, commoditiesRes, bondsRes, cryptoSentimentRes, centralBanksRes] = await Promise.allSettled([
        Promise.all(bistSymbols.map(async (s) => (await axios.get(`${SCRAPER_BASE_URL}/api/prices/stock?symbol=${s}`)).data)),
        Promise.all(usSymbols.map(async (s) => (await axios.get(`${SCRAPER_BASE_URL}/api/prices/stock?symbol=${s}`)).data)),
        Promise.all(goldTypes.map(async (g) => (await axios.get(`${SCRAPER_BASE_URL}/api/prices/gold?type=${g}`)).data)),
        Promise.all(cryptos.map(async (c) => (await axios.get(`${SCRAPER_BASE_URL}/api/prices/crypto?symbol=${c}&vs=usd`)).data)),
        axios.get(`${SCRAPER_BASE_URL}/api/prices/currency?base=USD&target=TRY`),
        axios.get(`${SCRAPER_BASE_URL}/api/prices/currency?base=EUR&target=TRY`),
        axios.get(`${SCRAPER_BASE_URL}/api/prices/stock?symbol=DXY`),
        axios.get(`${SCRAPER_BASE_URL}/api/prices/indices`),
        axios.get(`${SCRAPER_BASE_URL}/api/prices/commodities`),
        axios.get(`${SCRAPER_BASE_URL}/api/prices/bonds`),
        axios.get(`${SCRAPER_BASE_URL}/api/prices/crypto-sentiment`),
        axios.get(`${SCRAPER_BASE_URL}/api/prices/central-banks`),
      ]);

      let newStocks = bistStocksRef.current;
      if (stockResults.status === 'fulfilled' && stockResults.value.length > 0) {
        newStocks = stockResults.value.map((s, idx) => ({
          symbol: currentConfig.bist[idx]?.symbol || s.symbol,
          name: currentConfig.bist[idx]?.name || s.symbol,
          price: s.price ?? null,
          change: s.change ?? 0.0,
        }));
        bistStocksRef.current = newStocks;
        setBistStocks(newStocks);
      }

      let newUsStocks = usStocksRef.current;
      if (usResults.status === 'fulfilled' && usResults.value.length > 0) {
        newUsStocks = usResults.value.map((u, idx) => ({
          symbol: currentConfig.us[idx]?.symbol || u.symbol,
          name: currentConfig.us[idx]?.name || u.symbol,
          price: u.price ?? null,
          change: u.change ?? 0.0,
        }));
        usStocksRef.current = newUsStocks;
        setUsStocks(newUsStocks);
      }

      let newGolds = goldPricesRef.current;
      if (goldResults.status === 'fulfilled' && goldResults.value.length > 0) {
        newGolds = goldResults.value.map((g, idx) => ({
          type: currentConfig.gold[idx]?.type || g.type,
          label: currentConfig.gold[idx]?.label || g.label || g.type,
          price: g.price ?? null,
          change: g.change ?? 0.0,
        }));
        goldPricesRef.current = newGolds;
        setGoldPrices(newGolds);
      }

      let newCryptos = cryptoPricesRef.current;
      if (cryptoResults.status === 'fulfilled' && cryptoResults.value.length > 0) {
        newCryptos = cryptoResults.value.map((c, idx) => ({
          symbol: currentConfig.crypto[idx]?.symbol || c.symbol,
          name: currentConfig.crypto[idx]?.name || c.symbol,
          price: c.price ?? null,
          change: c.change ?? 0.0,
        }));
        cryptoPricesRef.current = newCryptos;
        setCryptoPrices(newCryptos);
      }

      let newRates = currencyRates;
      if (usdRate.status === 'fulfilled' || eurRate.status === 'fulfilled' || dxyRes.status === 'fulfilled') {
        newRates = {
          USD: usdRate.status === 'fulfilled' ? usdRate.value.data.rate || 48.82 : 48.82,
          EUR: eurRate.status === 'fulfilled' ? eurRate.value.data.rate || 55.95 : 55.95,
          usdChange: usdRate.status === 'fulfilled' ? usdRate.value.data.change || 0.0 : 0.0,
          eurChange: eurRate.status === 'fulfilled' ? eurRate.value.data.change || 0.0 : 0.0,
          dxy: dxyRes.status === 'fulfilled' ? dxyRes.value.data.price || 99.16 : 99.16,
          dxyChange: dxyRes.status === 'fulfilled' ? dxyRes.value.data.change || 0.0 : 0.0,
        };
        setCurrencyRates(newRates);
      }

      let newIndices = indices;
      if (indicesRes.status === 'fulfilled' && indicesRes.value.data) {
        newIndices = {
          XU100: indicesRes.value.data.XU100 || INITIAL_INDICES.XU100,
          SP500: indicesRes.value.data.SP500 || INITIAL_INDICES.SP500,
          NASDAQ: indicesRes.value.data.NASDAQ || INITIAL_INDICES.NASDAQ,
          sectors: indicesRes.value.data.sectors || indices.sectors || INITIAL_INDICES.sectors,
        };
        setIndices(newIndices);
      }

      let newCommodities = commodities;
      if (commoditiesRes.status === 'fulfilled' && commoditiesRes.value.data) {
        newCommodities = {
          brent: commoditiesRes.value.data.brent || INITIAL_COMMODITIES.brent,
          crude: commoditiesRes.value.data.crude || INITIAL_COMMODITIES.crude,
          gold: commoditiesRes.value.data.gold || INITIAL_COMMODITIES.gold,
          silver: commoditiesRes.value.data.silver || INITIAL_COMMODITIES.silver,
          vix: commoditiesRes.value.data.vix || INITIAL_COMMODITIES.vix,
        };
        setCommodities(newCommodities);
      }

      let newBonds = bonds;
      if (bondsRes.status === 'fulfilled' && bondsRes.value.data) {
        newBonds = {
          us10y: bondsRes.value.data.us10y || INITIAL_BONDS.us10y,
          us2y: bondsRes.value.data.us2y || INITIAL_BONDS.us2y,
        };
        setBonds(newBonds);
      }

      let newCryptoSentiment = cryptoSentiment;
      if (cryptoSentimentRes.status === 'fulfilled' && cryptoSentimentRes.value.data) {
        const cs = cryptoSentimentRes.value.data;
        newCryptoSentiment = {
          fng: {
            score: cs.fng?.score ?? INITIAL_CRYPTO_SENTIMENT.fng.score,
            classification: cs.fng?.classification ?? INITIAL_CRYPTO_SENTIMENT.fng.classification,
            classificationTr: cs.fng?.classification_tr || cs.fng?.classificationTr || INITIAL_CRYPTO_SENTIMENT.fng.classificationTr,
          },
          altcoinSeason: {
            score: cs.altcoin_season?.score ?? cs.altcoinSeason?.score ?? INITIAL_CRYPTO_SENTIMENT.altcoinSeason.score,
            season: cs.altcoin_season?.season ?? cs.altcoinSeason?.season ?? INITIAL_CRYPTO_SENTIMENT.altcoinSeason.season,
            seasonTr: cs.altcoin_season?.season_tr || cs.altcoinSeason?.seasonTr || INITIAL_CRYPTO_SENTIMENT.altcoinSeason.seasonTr,
          },
          btcDominance: {
            dominance: cs.btc_dominance?.dominance ?? cs.btcDominance?.dominance ?? INITIAL_CRYPTO_SENTIMENT.btcDominance.dominance,
            change: cs.btc_dominance?.change ?? cs.btcDominance?.change ?? INITIAL_CRYPTO_SENTIMENT.btcDominance.change,
          },
        };
        setCryptoSentiment(newCryptoSentiment);
      }

      let newCentralBanks = centralBanks;
      if (centralBanksRes.status === 'fulfilled' && centralBanksRes.value.data) {
        newCentralBanks = {
          TCMB: centralBanksRes.value.data.TCMB || INITIAL_CENTRAL_BANKS.TCMB,
          FED: centralBanksRes.value.data.FED || INITIAL_CENTRAL_BANKS.FED,
          ECB: centralBanksRes.value.data.ECB || INITIAL_CENTRAL_BANKS.ECB,
        };
        setCentralBanks(newCentralBanks);
      }

      setLastSyncTime(now);

      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('spendlog_market_cache');
          localStorage.setItem(
            'spendlog_market_cache_v3',
            JSON.stringify({
              stocks: newStocks,
              usStocks: newUsStocks,
              golds: newGolds,
              cryptos: newCryptos,
              rates: newRates,
              indices: newIndices,
              commodities: newCommodities,
              bonds: newBonds,
              cryptoSentiment: newCryptoSentiment,
              centralBanks: newCentralBanks,
              syncTime: now,
            })
          );
        } catch (_) {}
      }
    } catch (err) {
      console.warn('Failed to sync prices', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // LocalStorage'dan anında yükle ve arka planda güncelle
  useEffect(() => {
    let initialConfig = DEFAULT_WATCHLIST_CONFIG;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('spendlog_market_cache');
      } catch (_) {}

      const configKey = user?.id ? `spendlog_${user.id}_watchlist_config` : 'spendlog_watchlist_config';
      let savedWatchlist = localStorage.getItem(configKey);
      if (!savedWatchlist && user?.id) {
        savedWatchlist = localStorage.getItem('spendlog_watchlist_config');
      }
      if (savedWatchlist) {
        try {
          const parsedCfg = JSON.parse(savedWatchlist);
          if (parsedCfg && parsedCfg.bist && parsedCfg.gold && parsedCfg.crypto && parsedCfg.us) {
            initialConfig = parsedCfg;
            setWatchlistConfig(parsedCfg);
            watchlistConfigRef.current = parsedCfg;
          }
        } catch (e) {
          console.warn(e);
        }
      }

      const cached = localStorage.getItem('spendlog_market_cache_v3');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed.stocks) && parsed.stocks.length > 0) {
            setBistStocks(parsed.stocks);
            bistStocksRef.current = parsed.stocks;
          }
          if (Array.isArray(parsed.usStocks) && parsed.usStocks.length > 0) {
            setUsStocks(parsed.usStocks);
            usStocksRef.current = parsed.usStocks;
          }
          if (Array.isArray(parsed.golds) && parsed.golds.length > 0) {
            setGoldPrices(parsed.golds);
            goldPricesRef.current = parsed.golds;
          }
          if (Array.isArray(parsed.cryptos) && parsed.cryptos.length > 0) {
            setCryptoPrices(parsed.cryptos);
            cryptoPricesRef.current = parsed.cryptos;
          }
          if (parsed.rates) setCurrencyRates(parsed.rates);
          if (parsed.indices) {
            setIndices({
              ...parsed.indices,
              sectors: parsed.indices.sectors || INITIAL_INDICES.sectors,
            });
          }
          if (parsed.commodities) setCommodities(parsed.commodities);
          if (parsed.bonds) setBonds(parsed.bonds);
          if (parsed.cryptoSentiment) setCryptoSentiment(parsed.cryptoSentiment);
          if (parsed.centralBanks) setCentralBanks(parsed.centralBanks);
          if (parsed.syncTime) setLastSyncTime(parsed.syncTime);
        } catch (e) {
          console.warn(e);
        }
      }
    }

    // İlk yükleme (sessiz)
    handleRefreshLiveMarkets(true, initialConfig);

    // 30 saniyede bir sessiz arka plan senkronizasyonu (SWR Mantığı)
    const interval = setInterval(() => {
      handleRefreshLiveMarkets(true);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Modal İşlemleri
  const openWatchlistModal = (tab: WatchlistCategory = 'bist') => {
    setActiveWatchlistTab(tab);
    setEditingConfig(JSON.parse(JSON.stringify(watchlistConfigRef.current || watchlistConfig)));
    setNewSymbolInput('');
    setNewNameInput('');
    setModalInputError('');
    setIsWatchlistModalOpen(true);
  };

  const handleAddStockOrCryptoItem = () => {
    const sym = newSymbolInput.trim().toUpperCase();
    if (!sym) return;

    const currentList = editingConfig[activeWatchlistTab] as any[];
    if (currentList.some((item) => (item.symbol || '').toUpperCase() === sym)) {
      setModalInputError(`"${sym}" zaten listede mevcut.`);
      return;
    }

    const name = newNameInput.trim() || sym;
    const newItem = activeWatchlistTab === 'us'
      ? { symbol: sym, querySym: sym, name }
      : { symbol: sym, name };

    setEditingConfig((prev) => ({
      ...prev,
      [activeWatchlistTab]: [...(prev[activeWatchlistTab] as any[]), newItem],
    }));

    setNewSymbolInput('');
    setNewNameInput('');
    setModalInputError('');
  };

  const handleAddGoldItem = () => {
    const type = newSymbolInput.trim().toLowerCase();
    if (!type) return;

    const currentList = editingConfig.gold;
    if (currentList.some((item) => item.type.toLowerCase() === type)) {
      setModalInputError(`Bu altın/maden türü zaten listede mevcut.`);
      return;
    }

    const label = newNameInput.trim() || ALL_GOLD_PRESETS.find((p) => p.type === type)?.label || type;
    setEditingConfig((prev) => ({
      ...prev,
      gold: [...prev.gold, { type, label }],
    }));

    setNewSymbolInput('');
    setNewNameInput('');
    setModalInputError('');
  };

  const handleAddSuggestion = (sug: any) => {
    if (activeWatchlistTab === 'gold') {
      const type = sug.type || sug.symbol;
      if (editingConfig.gold.some((g) => g.type.toLowerCase() === type.toLowerCase())) return;
      setEditingConfig((prev) => ({
        ...prev,
        gold: [...prev.gold, { type, label: sug.label || sug.name || type }],
      }));
    } else {
      const sym = (sug.symbol || '').toUpperCase();
      const currentList = editingConfig[activeWatchlistTab] as any[];
      if (currentList.some((item) => (item.symbol || '').toUpperCase() === sym)) return;
      const newItem = activeWatchlistTab === 'us'
        ? { symbol: sym, querySym: sym, name: sug.name || sym }
        : { symbol: sym, name: sug.name || sym };
      setEditingConfig((prev) => ({
        ...prev,
        [activeWatchlistTab]: [...(prev[activeWatchlistTab] as any[]), newItem],
      }));
    }
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    setEditingConfig((prev) => {
      const list = [...prev[activeWatchlistTab]];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      return {
        ...prev,
        [activeWatchlistTab]: list,
      };
    });
  };

  const handleRemoveItem = (index: number) => {
    setEditingConfig((prev) => {
      const list = [...prev[activeWatchlistTab]];
      list.splice(index, 1);
      return {
        ...prev,
        [activeWatchlistTab]: list,
      };
    });
  };

  const handleResetToDefaults = () => {
    setEditingConfig((prev) => ({
      ...prev,
      [activeWatchlistTab]: JSON.parse(JSON.stringify(DEFAULT_WATCHLIST_CONFIG[activeWatchlistTab])),
    }));
  };

  const handleSaveWatchlistConfig = () => {
    setWatchlistConfig(editingConfig);
    watchlistConfigRef.current = editingConfig;
    if (typeof window !== 'undefined') {
      const configKey = user?.id ? `spendlog_${user.id}_watchlist_config` : 'spendlog_watchlist_config';
      localStorage.setItem(configKey, JSON.stringify(editingConfig));
    }
    setIsWatchlistModalOpen(false);
    handleRefreshLiveMarkets(false, editingConfig);
  };

  const availableSuggestions = useMemo(() => {
    const allSug = POPULAR_SUGGESTIONS[activeWatchlistTab] || [];
    if (activeWatchlistTab === 'gold') {
      return allSug.filter((sug) => !editingConfig.gold.some((g) => g.type.toLowerCase() === (sug.type || sug.symbol)?.toLowerCase()));
    }
    const currentList = editingConfig[activeWatchlistTab] as any[];
    return allSug.filter((sug) => !currentList.some((item) => (item.symbol || '').toUpperCase() === (sug.symbol || '').toUpperCase()));
  }, [activeWatchlistTab, editingConfig]);

  const currentTabItems = editingConfig[activeWatchlistTab] || [];

  const usSession = getMarketSessionStatus('US');
  const bistSession = getMarketSessionStatus('BIST');
  const gramAltinItem = goldPrices.find((g) => g.type === 'gram-altin') || INITIAL_GOLDS[0];
  const gramGumusItem = goldPrices.find((g) => g.type === 'gumus') || INITIAL_GOLDS[1];
  const btcItem = cryptoPrices.find((c) => c.symbol === 'BTC') || INITIAL_CRYPTOS[0];

  return (
    <div>
      <Header
        title="Canlı Piyasalar"
        description="Canlı hisse senetleri, kıymetli madenler, kripto paralar ve serbest piyasa kurlarının anlık akışı"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl shadow-xs text-[11px] font-medium text-slate-400 h-[38px]">
              {isRefreshing ? (
                <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
              ) : (
                <span className="relative flex h-2 w-2 shrink-0" title="Canlı Otomatik Senkronizasyon (30s)">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
              <span>
                Son Güncelleme:{' '}
                <strong className="text-slate-200 font-mono font-semibold ml-0.5">
                  {lastSyncTime || 'Az önce'}
                </strong>
              </span>
            </div>

            <button
              onClick={() => openWatchlistModal('bist')}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl border border-slate-700 transition cursor-pointer"
              title="Tüm piyasa izleme listelerini yönet"
            >
              <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
              <span>Listeleri Düzenle</span>
            </button>

            <button
              onClick={() => handleRefreshLiveMarkets(false)}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl border border-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : 'text-indigo-400'}`} />
              <span>{isRefreshing ? 'Taranıyor...' : 'Fiyatları Yenile'}</span>
            </button>
          </div>
        }
      />

      {/* Currency & KPI Rates Banner - 5'li Simetrik Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        {/* 1. Döviz Kurları & DXY (USD/TRY, EUR/TRY & DXY Tek Kutuda Alt Alta) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg flex flex-col justify-between border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-emerald-300 font-semibold uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-400" />
              <span>Döviz Kurları</span>
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">USD / TRY</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : `${currencyRates.USD?.toFixed(2) || '48.82'} ₺`}
                </span>
                <ChangeBadge change={currencyRates.usdChange} className="!text-[10px] !px-1.5 !py-0" />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">EUR / TRY</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : `${currencyRates.EUR?.toFixed(2) || '55.95'} ₺`}
                </span>
                <ChangeBadge change={currencyRates.eurChange} className="!text-[10px] !px-1.5 !py-0" />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">DXY (Dolar End.)</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : `${currencyRates.dxy?.toFixed(2) || '99.16'}`}
                </span>
                <ChangeBadge change={currencyRates.dxyChange} className="!text-[10px] !px-1.5 !py-0" />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Gram Altın & Gümüş (Tek Kutuda Alt Alta) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg flex flex-col justify-between border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-amber-300 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-400" />
              <span>Gram Altın & Gümüş</span>
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Gram Altın</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : `${gramAltinItem?.price?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '6.898,85'} ₺`}
                </span>
                <ChangeBadge change={gramAltinItem?.change} className="!text-[10px] !px-1.5 !py-0" />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Gram Gümüş</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : `${gramGumusItem?.price?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '103,13'} ₺`}
                </span>
                <ChangeBadge change={gramGumusItem?.change} className="!text-[10px] !px-1.5 !py-0" />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Bitcoin (BTC) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between border-l-4 border-l-yellow-500">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 justify-between">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider truncate">Bitcoin</span>
              <ChangeBadge change={btcItem?.change} />
            </div>
            <p className="text-lg font-bold text-yellow-400 mt-1 font-mono truncate">
              {isValuesHidden ? '***' : `$${btcItem?.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '79,792.42'}`}
            </p>
          </div>
          <Coins className="w-7 h-7 text-yellow-400/20 shrink-0" />
        </div>

        {/* 4. BIST 100 (XU100) & Sektör Endeksleri */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg flex flex-col justify-between border-l-4 border-l-cyan-500">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-[11px] text-cyan-300 font-semibold uppercase tracking-wider whitespace-nowrap">BIST 100</span>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border transition-colors shrink-0 ${
                    bistSession.isOpen
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700/60'
                  }`}
                >
                  <span className={`w-1 h-1 rounded-full ${bistSession.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {bistSession.isOpen ? 'AÇIK' : 'KAPALI'}
                </span>
              </div>
              <ChangeBadge change={indices.XU100?.change} className="!text-[10px] !px-1.5 !py-0" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-base font-bold text-cyan-400 font-mono tracking-tight">
                {isValuesHidden ? '***' : indices.XU100?.price ? `${indices.XU100.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : '— ₺'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const next = !isBistSectorsExpanded;
                    setIsBistSectorsExpanded(next);
                    try {
                      const bistKey = user?.id ? `spendlog_${user.id}_bist_sectors_expanded` : 'spendlog_bist_sectors_expanded';
                      localStorage.setItem(bistKey, String(next));
                    } catch (_) {}
                  }}
                  title={isBistSectorsExpanded ? "Sektör Endekslerini Gizle (Derli Toplu Mod)" : "Sektör Endekslerini Göster (XBANK, XHOLD, vb.)"}
                  className="p-1 -mr-1 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition cursor-pointer flex items-center justify-center group"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isBistSectorsExpanded ? 'rotate-180 text-cyan-400' : 'text-slate-400 group-hover:text-cyan-300'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* 5 Majör Sektör Alt Alta (Dinamik Akordiyon) */}
          {isBistSectorsExpanded && (
            <div className="border-t border-slate-800/80 pt-2 mt-2 space-y-1.5 animate-in fade-in duration-200">
              {/* 1. XBANK */}
              <div className="flex items-center justify-between text-xs" title="BIST Bankacılık (XBANK)">
                <span className="text-slate-300 font-medium">XBANK</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="font-bold text-white text-[11px]">
                    {isValuesHidden ? '***' : indices.sectors?.XBANK?.price ? Math.round(indices.sectors.XBANK.price).toLocaleString('tr-TR') : '—'}
                  </span>
                  <ChangeBadge change={indices.sectors?.XBANK?.change} className="!text-[10px] !px-1.5 !py-0" />
                </div>
              </div>

              {/* 2. XHOLD */}
              <div className="flex items-center justify-between text-xs" title="BIST Holding & Yatırım (XHOLD)">
                <span className="text-slate-300 font-medium">XHOLD</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="font-bold text-white text-[11px]">
                    {isValuesHidden ? '***' : indices.sectors?.XHOLD?.price ? Math.round(indices.sectors.XHOLD.price).toLocaleString('tr-TR') : '—'}
                  </span>
                  <ChangeBadge change={indices.sectors?.XHOLD?.change} className="!text-[10px] !px-1.5 !py-0" />
                </div>
              </div>

              {/* 3. XUSIN */}
              <div className="flex items-center justify-between text-xs" title="BIST Sınai (XUSIN)">
                <span className="text-slate-300 font-medium">XUSIN</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="font-bold text-white text-[11px]">
                    {isValuesHidden ? '***' : indices.sectors?.XUSIN?.price ? Math.round(indices.sectors.XUSIN.price).toLocaleString('tr-TR') : '—'}
                  </span>
                  <ChangeBadge change={indices.sectors?.XUSIN?.change} className="!text-[10px] !px-1.5 !py-0" />
                </div>
              </div>

              {/* 4. XULAS */}
              <div className="flex items-center justify-between text-xs" title="BIST Ulaştırma (XULAS)">
                <span className="text-slate-300 font-medium">XULAS</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="font-bold text-white text-[11px]">
                    {isValuesHidden ? '***' : indices.sectors?.XULAS?.price ? Math.round(indices.sectors.XULAS.price).toLocaleString('tr-TR') : '—'}
                  </span>
                  <ChangeBadge change={indices.sectors?.XULAS?.change} className="!text-[10px] !px-1.5 !py-0" />
                </div>
              </div>

              {/* 5. XGMYO */}
              <div className="flex items-center justify-between text-xs" title="BIST Gayrimenkul Yat. Ort. (XGMYO)">
                <span className="text-slate-300 font-medium">XGMYO</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="font-bold text-white text-[11px]">
                    {isValuesHidden ? '***' : indices.sectors?.XGMYO?.price ? Math.round(indices.sectors.XGMYO.price).toLocaleString('tr-TR') : '—'}
                  </span>
                  <ChangeBadge change={indices.sectors?.XGMYO?.change} className="!text-[10px] !px-1.5 !py-0" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 5. ABD Piyasaları (S&P 500 & NASDAQ Tek Kutuda Alt Alta) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg flex flex-col justify-between border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-purple-300 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Globe className="w-3 h-3 text-purple-400" />
              <span>ABD Piyasaları</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border transition-colors whitespace-nowrap shrink-0 ${
                usSession.isOpen
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700/60'
              }`}
            >
              <span className={`w-1 h-1 rounded-full ${usSession.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {usSession.label}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">S&P 500</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : indices.SP500?.price ? indices.SP500.price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
                </span>
                <ChangeBadge change={indices.SP500?.change} className="!text-[10px] !px-1.5 !py-0" />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">NASDAQ</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : indices.NASDAQ?.price ? indices.NASDAQ.price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
                </span>
                <ChangeBadge change={indices.NASDAQ?.change} className="!text-[10px] !px-1.5 !py-0" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Makro & Emtia Banner - Üst Sırayla Birebir Aynı Boyutlarda (lg:grid-cols-5) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* 1. Enerji & Küresel Risk (Brent, Ham Petrol & VIX - Döviz Kurlarının Hemen Altı) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg flex flex-col justify-between border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-orange-300 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Fuel className="w-3 h-3 text-orange-400" />
              <span>Enerji & Risk (VIX)</span>
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium truncate" title="Brent Petrol (BZ=F)">Brent Petrol</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : commodities.brent?.price ? `$${commodities.brent.price.toFixed(2)}` : '—'}
                </span>
                <ChangeBadge change={commodities.brent?.change} className="!text-[10px] !px-1.5 !py-0" />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium truncate" title="Ham Petrol (CL=F WTI)">Ham Petrol (WTI)</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : commodities.crude?.price ? `$${commodities.crude.price.toFixed(2)}` : '—'}
                </span>
                <ChangeBadge change={commodities.crude?.change} className="!text-[10px] !px-1.5 !py-0" />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium truncate" title="VIX Volatilite / Korku Endeksi">VIX (Korku End.)</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : commodities.vix?.price ? `${commodities.vix.price.toFixed(2)}` : '—'}
                </span>
                <ChangeBadge change={commodities.vix?.change} className="!text-[10px] !px-1.5 !py-0" />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Değerli Metaller (ONS) (XAU/USD & XAG/USD - Gram Altın Divinin Hemen Altı) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg flex flex-col justify-between border-l-4 border-l-yellow-500">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-yellow-300 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-yellow-400" />
              <span>Değerli Metaller (ONS)</span>
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium truncate">XAU / USD (Ons)</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : `$${commodities.gold?.price?.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) || '4,477.20'}`}
                </span>
                <ChangeBadge change={commodities.gold?.change} className="!text-[10px] !px-1.5 !py-0" />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium truncate">XAG / USD (Ons)</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : `$${commodities.silver?.price?.toFixed(2) || '66.82'}`}
                </span>
                <ChangeBadge change={commodities.silver?.change} className="!text-[10px] !px-1.5 !py-0" />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Kripto Barometresi (Bitcoin Divinin Hemen Altı) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg flex flex-col justify-between border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-amber-300 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Gauge className="w-3 h-3 text-amber-400" />
              <span>Kripto Barometresi</span>
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium shrink-0">Korku & Hırs</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : `${cryptoSentiment.fng?.score ?? 74}`}
                </span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border whitespace-nowrap ${
                    (cryptoSentiment.fng?.score ?? 74) >= 60
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : (cryptoSentiment.fng?.score ?? 74) <= 40
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {cryptoSentiment.fng?.classificationTr || 'Açgözlülük'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium shrink-0">Altcoin Sezonu</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : `${cryptoSentiment.altcoinSeason?.score ?? 33}/100`}
                </span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border whitespace-nowrap ${
                    (cryptoSentiment.altcoinSeason?.score ?? 33) >= 75
                      ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {(cryptoSentiment.altcoinSeason?.score ?? 33) >= 75 ? 'Altcoin Sezonu' : 'BTC Sezonu'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium shrink-0">BTC Dominansı</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : `%${cryptoSentiment.btcDominance?.dominance?.toFixed(2) || '59.22'}`}
                </span>
                <ChangeBadge change={cryptoSentiment.btcDominance?.change} className="!text-[10px] !px-1.5 !py-0.5" />
              </div>
            </div>
          </div>
        </div>

        {/* 4. Dünya Merkez Bankaları (TCMB, FED, ECB - BIST 100 Divinin Hemen Altı) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg flex flex-col justify-between border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-indigo-300 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Landmark className="w-3 h-3 text-indigo-400" />
              <span>Merkez Bankaları</span>
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium shrink-0 flex items-center gap-1.5">
                <span>🇹🇷</span>
                <span>TCMB</span>
              </span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : `%${centralBanks.TCMB?.rate?.toFixed(2) || '37.00'}`}
                </span>
                <span
                  className="text-[9px] bg-rose-500/10 text-rose-300 border border-rose-500/20 px-1.5 py-0.5 rounded-md font-sans font-medium whitespace-nowrap"
                  title="Son Değişim: 22.01.2026 (-100bp)"
                >
                  {centralBanks.TCMB?.lastChange ? centralBanks.TCMB.lastChange.replace(/\.202\d/, '') : '22.01 (-100bp)'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium shrink-0 flex items-center gap-1.5">
                <span>🇺🇸</span>
                <span>FED</span>
              </span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : `%${centralBanks.FED?.rate?.toFixed(2) || '3.75'}`}
                </span>
                <span
                  className="text-[9px] bg-rose-500/10 text-rose-300 border border-rose-500/20 px-1.5 py-0.5 rounded-md font-sans font-medium whitespace-nowrap"
                  title="Son Değişim: 10.12.2025 (-25bp)"
                >
                  {centralBanks.FED?.lastChange ? centralBanks.FED.lastChange.replace(/\.202\d/, '') : '10.12 (-25bp)'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium shrink-0 flex items-center gap-1.5">
                <span>🇪🇺</span>
                <span>ECB</span>
              </span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : `%${centralBanks.ECB?.rate?.toFixed(2) || '2.40'}`}
                </span>
                <span
                  className="text-[9px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-sans font-medium whitespace-nowrap"
                  title="Son Değişim: 11.06.2026 (25bp)"
                >
                  {centralBanks.ECB?.lastChange ? centralBanks.ECB.lastChange.replace(/\.202\d/, '').replace(/\((\d+bp)\)/, '(+$1)') : '11.06 (+25bp)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. ABD Tahvil Faizleri (US10Y & US2Y - ABD Piyasaları Divinin Hemen Altı) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg flex flex-col justify-between border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-blue-300 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Percent className="w-3 h-3 text-blue-400" />
              <span>ABD Tahvil Faizleri</span>
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium truncate" title="ABD 10 Yıllık Tahvil Faizi (^TNX)">ABD 10Y (US10Y)</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : `%${bonds.us10y?.price?.toFixed(2) || '4.78'}`}
                </span>
                <ChangeBadge change={bonds.us10y?.change} className="!text-[10px] !px-1.5 !py-0" />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium truncate" title="ABD 2 Yıllık Tahvil Faizi (2YY=F - FED Beklentileri)">ABD 2Y (US2Y)</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-white text-[11px]">
                  {isValuesHidden ? '***' : `%${bonds.us2y?.price?.toFixed(2) || '3.96'}`}
                </span>
                <ChangeBadge change={bonds.us2y?.change} className="!text-[10px] !px-1.5 !py-0" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Market Sections (4 Kolon) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Kolon 1: BIST Hisseleri */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl min-h-[380px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <span>BIST Hisseleri</span>
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold border transition-colors ${
                    bistSession.isOpen
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700/60'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${bistSession.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {bistSession.label}
                </span>
                <button
                  onClick={() => openWatchlistModal('bist')}
                  title="BIST Hisseleri Listesini Düzenle"
                  className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-800/60">
              {bistStocks.length === 0 ? (
                <div className="space-y-3 py-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-1 animate-pulse">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-12 bg-slate-800 rounded"></div>
                        <div className="h-3 w-16 bg-slate-800/60 rounded"></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-14 bg-slate-800 rounded"></div>
                        <div className="h-4 w-12 bg-slate-800/80 rounded-lg"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                bistStocks.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-800/40 rounded-xl transition">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white">{s.symbol}</span>
                        {s.name && <span className="text-[10px] text-slate-500 font-normal truncate max-w-[85px]">{s.name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.price != null ? (
                        <>
                          <span className="font-bold text-xs text-slate-200 font-mono">
                            {isValuesHidden ? '***' : `${s.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`}
                          </span>
                          <ChangeBadge change={s.change} />
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 animate-pulse">
                          <div className="h-3.5 w-14 bg-slate-800 rounded"></div>
                          <div className="h-4 w-12 bg-slate-800/60 rounded-lg"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Kolon 2: Serbest Piyasa Altın */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl min-h-[380px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Serbest Piyasa Altın</span>
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openWatchlistModal('gold')}
                  title="Altın & Emtia Listesini Düzenle"
                  className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-800/60">
              {goldPrices.length === 0 ? (
                <div className="space-y-3 py-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-1 animate-pulse">
                      <div className="h-4 w-28 bg-slate-800 rounded"></div>
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-16 bg-slate-800 rounded"></div>
                        <div className="h-4 w-12 bg-slate-800/80 rounded-lg"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                goldPrices.map((g, idx) => {
                  const isOns = g.type === 'ons-altin' || g.label?.includes('ONS');
                  return (
                    <div key={idx} className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-800/40 rounded-xl transition">
                      <div className="min-w-0 pr-2">
                        <span className="font-medium text-xs text-slate-300 block truncate">
                          {g.label || g.type.replace('-', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {g.price != null ? (
                          <>
                            <span className="font-bold text-xs text-amber-400 font-mono">
                              {isValuesHidden ? '***' : `${g.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${isOns ? '$' : '₺'}`}
                            </span>
                            <ChangeBadge change={g.change} />
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5 animate-pulse">
                            <div className="h-3.5 w-16 bg-slate-800 rounded"></div>
                            <div className="h-4 w-12 bg-slate-800/60 rounded-lg"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Kolon 3: Kripto Paralar (Binance) */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl min-h-[380px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400" />
                <span>Kripto Paralar</span>
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openWatchlistModal('crypto')}
                  title="Kripto Para Listesini Düzenle"
                  className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-800/60">
              {cryptoPrices.length === 0 ? (
                <div className="space-y-3 py-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-1 animate-pulse">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-10 bg-slate-800 rounded"></div>
                        <div className="h-3 w-16 bg-slate-800/60 rounded"></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-14 bg-slate-800 rounded"></div>
                        <div className="h-4 w-12 bg-slate-800/80 rounded-lg"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                cryptoPrices.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-800/40 rounded-xl transition">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white">{c.symbol}</span>
                        {c.name && <span className="text-[10px] text-slate-500 font-normal">({c.name})</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.price != null ? (
                        <>
                          <span className="font-bold text-xs text-emerald-400 font-mono">
                            {isValuesHidden ? '***' : `$${c.price.toLocaleString('en-US', { minimumFractionDigits: c.price < 10 ? 3 : 2, maximumFractionDigits: c.price < 10 ? 3 : 2 })}`}
                          </span>
                          <ChangeBadge change={c.change} />
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 animate-pulse">
                          <div className="h-3.5 w-14 bg-slate-800 rounded"></div>
                          <div className="h-4 w-12 bg-slate-800/60 rounded-lg"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Kolon 4: ABD Hisseleri */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl min-h-[380px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-400" />
                <span>ABD Hisseleri</span>
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold border transition-colors ${
                    usSession.isOpen
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700/60'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${usSession.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {usSession.label}
                </span>
                <button
                  onClick={() => openWatchlistModal('us')}
                  title="ABD Hisseleri Listesini Düzenle"
                  className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-800/60">
              {usStocks.length === 0 ? (
                <div className="space-y-3 py-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-1 animate-pulse">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-12 bg-slate-800 rounded"></div>
                        <div className="h-3 w-16 bg-slate-800/60 rounded"></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-14 bg-slate-800 rounded"></div>
                        <div className="h-4 w-12 bg-slate-800/80 rounded-lg"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                usStocks.map((u, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-800/40 rounded-xl transition">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white">{u.symbol}</span>
                        {u.name && <span className="text-[10px] text-slate-500 font-normal truncate max-w-[85px]">{u.name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {u.price != null ? (
                        <>
                          <span className="font-bold text-xs text-purple-300 font-mono">
                            {isValuesHidden ? '***' : `$${u.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </span>
                          <ChangeBadge change={u.change} />
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 animate-pulse">
                          <div className="h-3.5 w-14 bg-slate-800 rounded"></div>
                          <div className="h-4 w-12 bg-slate-800/60 rounded-lg"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bütünleşik İzleme Listesi Yöneticisi Modal (Watchlist Hub Modal) */}
      {isWatchlistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">İzleme Listeleri Yöneticisi</h2>
                  <p className="text-xs text-slate-400">Kartlarda anlık takip edilecek varlıkları özelleştirin</p>
                </div>
              </div>
              <button
                onClick={() => setIsWatchlistModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center px-6 border-b border-slate-800/80 bg-slate-950/40 gap-1 overflow-x-auto">
              {(
                [
                  { key: 'bist', label: 'BIST Hisseleri', count: editingConfig.bist.length, color: 'text-indigo-400 border-indigo-500' },
                  { key: 'gold', label: 'Altın & Maden', count: editingConfig.gold.length, color: 'text-amber-400 border-amber-500' },
                  { key: 'crypto', label: 'Kripto Paralar', count: editingConfig.crypto.length, color: 'text-emerald-400 border-emerald-500' },
                  { key: 'us', label: 'ABD Hisseleri', count: editingConfig.us.length, color: 'text-purple-400 border-purple-500' },
                ] as const
              ).map((tab) => {
                const isActive = activeWatchlistTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveWatchlistTab(tab.key);
                      setNewSymbolInput('');
                      setNewNameInput('');
                      setModalInputError('');
                    }}
                    className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition cursor-pointer shrink-0 ${
                      isActive
                        ? `${tab.color} text-white`
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${isActive ? 'bg-white/15 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tab Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Add Input Section */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Yeni Varlık Ekle</span>
                  </span>
                  {modalInputError && (
                    <span className="text-[11px] text-rose-400 font-medium animate-in fade-in">
                      {modalInputError}
                    </span>
                  )}
                </div>

                {activeWatchlistTab === 'gold' ? (
                  <div className="flex gap-2">
                    <select
                      value={newSymbolInput}
                      onChange={(e) => {
                        setNewSymbolInput(e.target.value);
                        const selectedPreset = ALL_GOLD_PRESETS.find((p) => p.type === e.target.value);
                        if (selectedPreset) setNewNameInput(selectedPreset.label);
                        setModalInputError('');
                      }}
                      className="bg-slate-900 border border-slate-800 text-white text-xs rounded-xl px-3 py-2 flex-1 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Altın / Maden Türü Seçin...</option>
                      {ALL_GOLD_PRESETS.map((p) => {
                        const alreadyInList = editingConfig.gold.some((g) => g.type.toLowerCase() === p.type.toLowerCase());
                        return (
                          <option key={p.type} value={p.type} disabled={alreadyInList}>
                            {p.label} {alreadyInList ? '(Listede Mevcut)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      onClick={handleAddGoldItem}
                      disabled={!newSymbolInput}
                      className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ekle</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder={
                        activeWatchlistTab === 'bist'
                          ? 'Hisse Kodu (Örn: BIMAS)'
                          : activeWatchlistTab === 'crypto'
                          ? 'Kripto Kodu (Örn: DOGE)'
                          : 'Hisse Kodu (Örn: PLTR)'
                      }
                      value={newSymbolInput}
                      onChange={(e) => {
                        setNewSymbolInput(e.target.value.toUpperCase());
                        setModalInputError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddStockOrCryptoItem();
                      }}
                      className="bg-slate-900 border border-slate-800 text-white placeholder:text-slate-500 text-xs rounded-xl px-3 py-2 flex-1 font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="Şirket / Varlık Adı (Opsiyonel)"
                      value={newNameInput}
                      onChange={(e) => setNewNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddStockOrCryptoItem();
                      }}
                      className="bg-slate-900 border border-slate-800 text-white placeholder:text-slate-500 text-xs rounded-xl px-3 py-2 flex-1 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={handleAddStockOrCryptoItem}
                      disabled={!newSymbolInput.trim()}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ekle</span>
                    </button>
                  </div>
                )}

                {/* Hızlı Öneri Çipleri */}
                {availableSuggestions.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[11px] text-slate-500 block mb-1.5 font-medium">Hızlı Öneriler:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {availableSuggestions.map((sug, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAddSuggestion(sug)}
                          className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5 text-indigo-400" />
                          <span>{sug.symbol || sug.label || sug.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Güncel Varlık Listesi */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    İzlenen Varlıklar ({currentTabItems.length})
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Sıralamak için oklara tıklayın
                  </span>
                </div>

                <div className="divide-y divide-slate-800/50 bg-slate-950/40 border border-slate-800/80 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                  {currentTabItems.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      Bu listede henüz takip edilen varlık yok. Yukarıdan ekleyebilirsiniz.
                    </div>
                  ) : (
                    currentTabItems.map((item: any, idx: number) => {
                      const sym = item.symbol || item.type;
                      const label = item.name || item.label || item.type;
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-2.5 px-3.5 hover:bg-slate-900/50 transition group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 text-[10px] text-slate-500 font-mono text-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-white block truncate">{sym}</span>
                              {label && label !== sym && (
                                <span className="text-[10px] text-slate-400 block truncate">{label}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleMoveItem(idx, 'up')}
                              disabled={idx === 0}
                              title="Yukarı Taşı"
                              className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800 transition cursor-pointer disabled:cursor-not-allowed"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMoveItem(idx, 'down')}
                              disabled={idx === currentTabItems.length - 1}
                              title="Aşağı Taşı"
                              className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800 transition cursor-pointer disabled:cursor-not-allowed"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              title="Listeden Çıkar"
                              className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer ml-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/80 bg-slate-900/90">
              <button
                onClick={handleResetToDefaults}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-300 font-medium px-3 py-2 rounded-xl hover:bg-slate-800 border border-transparent hover:border-slate-700 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Varsayılanlara Sıfırla</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsWatchlistModalOpen(false)}
                  className="text-xs text-slate-400 hover:text-white font-medium px-4 py-2 rounded-xl hover:bg-slate-800 transition cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleSaveWatchlistConfig}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/20 transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Kaydet & Uygula</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
