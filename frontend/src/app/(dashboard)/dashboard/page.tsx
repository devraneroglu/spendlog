'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { api, SCRAPER_BASE_URL } from '@/lib/axios';
import { useAuthStore } from '@/store/auth-store';
import { Account, Transaction, TransactionType } from '@/types/finance';
import { PortfolioSummary, PortfolioItem } from '@/types/portfolio';
import { PaymentPlan, PaymentPlanType } from '@/types/payment-plan';
import { PeriodSummary } from '@/types/credit-card';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { LiveClock } from '@/components/ui/LiveIndicator';
import { DashboardCardSkeleton } from '@/components/ui/Skeleton';
import { QuickTransactionModal } from '@/components/modules/QuickTransactionModal';
import axios from 'axios';
import {
  Landmark,
  TrendingUp,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Plus,
  CheckCircle2,
  Sparkles,
  Home,
  ChevronDown,
  Fuel,
  Bell,
  CalendarDays,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';

export default function DashboardPage() {
  const isValuesHidden = useAuthStore((state) => state.isValuesHidden);
  const user = useAuthStore((state) => state.user);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
  const [cardPeriods, setCardPeriods] = useState<PeriodSummary[]>([]);
  const [liveCardPeriods, setLiveCardPeriods] = useState<PeriodSummary[]>([]);
  const [marketRates, setMarketRates] = useState<any>({ USD: 48.03, EUR: 56.17, Gold: 7157.41, BTC: 78640 });
  const [lastSyncTime, setLastSyncTime] = useState<string>('Az önce');
  const [isLoading, setIsLoading] = useState(true);

  // Hızlı Eylem Menüsü State & Ref
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const quickMenuRef = useRef<HTMLDivElement>(null);

  // Dashboard Üzerinde Hızlı İşlem Modalı State
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  // Dışarı tıklamayı ve ESC tuşunu dinle
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quickMenuRef.current && !quickMenuRef.current.contains(e.target as Node)) {
        setIsQuickMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsQuickMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const fetchLiveMarketRates = async (fallbackUsd: number) => {
    try {
      const [usdRes, eurRes, goldRes, btcRes] = await Promise.allSettled([
        axios.get(`${SCRAPER_BASE_URL}/api/prices/currency?base=USD&target=TRY`, { timeout: 2500 }),
        axios.get(`${SCRAPER_BASE_URL}/api/prices/currency?base=EUR&target=TRY`, { timeout: 2500 }),
        axios.get(`${SCRAPER_BASE_URL}/api/prices/gold?type=gram-altin`, { timeout: 2500 }),
        axios.get(`${SCRAPER_BASE_URL}/api/prices/crypto?symbol=BTC&vs=usd`, { timeout: 2500 }),
      ]);

      const liveUsd = usdRes.status === 'fulfilled' && usdRes.value.data?.rate ? usdRes.value.data.rate : fallbackUsd;
      const liveEur = eurRes.status === 'fulfilled' && eurRes.value.data?.rate ? eurRes.value.data.rate : 56.17;
      const liveGold = goldRes.status === 'fulfilled' && goldRes.value.data?.price ? goldRes.value.data.price : 7157.41;
      const liveBtc = btcRes.status === 'fulfilled' && btcRes.value.data?.price ? btcRes.value.data.price : 78640;

      const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(now);

      setMarketRates({
        USD: liveUsd,
        EUR: liveEur,
        Gold: liveGold,
        BTC: liveBtc,
      });
    } catch (e) {
      console.warn('Scraper prices offline, using cache.');
    }
  };

  const fetchDashboardData = async (customUsdRate?: number) => {
    try {
      // 1. Önce LocalStorage Market & Dashboard Cache varsa 0 ms'de anında yükle
      let initialUsd = customUsdRate || 48.03;
      const userCacheKey = user?.id ? `spendlog_${user.id}_dashboard_data` : 'spendlog_dashboard_data';

      if (typeof window !== 'undefined') {
        const cachedMarket = localStorage.getItem('spendlog_market_cache');
        if (cachedMarket) {
          try {
            const parsed = JSON.parse(cachedMarket);
            if (parsed.rates?.USD) initialUsd = parsed.rates.USD;
            if (parsed.syncTime) setLastSyncTime(parsed.syncTime);
            setMarketRates({
              USD: parsed.rates?.USD || 48.03,
              EUR: parsed.rates?.EUR || 56.17,
              Gold: parsed.golds?.[0]?.price || 7157.41,
              BTC: parsed.cryptos?.[0]?.price || 78640,
            });
          } catch (e) {}
        }

        const cachedDash = localStorage.getItem(userCacheKey);
        if (cachedDash) {
          try {
            const parsed = JSON.parse(cachedDash);
            if (parsed.accounts) setAccounts(parsed.accounts);
            if (parsed.transactions) setTransactions(parsed.transactions);
            if (parsed.portfolioItems) setPortfolioItems(parsed.portfolioItems);
            if (parsed.portfolioSummary) setPortfolioSummary(parsed.portfolioSummary);
            if (parsed.paymentPlans) setPaymentPlans(parsed.paymentPlans);
            if (parsed.cardPeriods) setCardPeriods(parsed.cardPeriods);
            if (parsed.liveCardPeriods) setLiveCardPeriods(parsed.liveCardPeriods);
            setIsLoading(false); // Önbellek varsa beklemeden anında çiz!
          } catch (e) {}
        }
      }

      // 2. .NET 10 API İsteklerini Paralel Çek
      const [accRes, transRes, itemsRes, portRes, planRes, periodRes, livePeriodRes] = await Promise.allSettled([
        api.get<Account[]>('/api/accounts'),
        api.get<Transaction[]>('/api/transactions'),
        api.get<PortfolioItem[]>('/api/portfolio'),
        api.get<PortfolioSummary>(`/api/portfolio/summary?usdRate=${initialUsd}`),
        api.get<PaymentPlan[]>('/api/paymentplans'),
        api.get<PeriodSummary[]>('/api/creditcardexpenses/periods?isLiveEntry=false'),
        api.get<PeriodSummary[]>('/api/creditcardexpenses/periods?isLiveEntry=true'),
      ]);

      const newAccounts = accRes.status === 'fulfilled' ? accRes.value.data : [];
      const newTransactions = transRes.status === 'fulfilled' ? transRes.value.data : [];
      const newItems = itemsRes.status === 'fulfilled' ? itemsRes.value.data : [];
      const newPort = portRes.status === 'fulfilled' ? portRes.value.data : null;
      const newPlans = planRes.status === 'fulfilled' ? planRes.value.data : [];
      const newPeriods = periodRes.status === 'fulfilled' ? periodRes.value.data : [];
      const newLivePeriods = livePeriodRes.status === 'fulfilled' ? livePeriodRes.value.data : [];

      setAccounts(newAccounts);
      setTransactions(newTransactions);
      setPortfolioItems(newItems);
      setPortfolioSummary(newPort);
      setPaymentPlans(newPlans);
      setCardPeriods(newPeriods);
      setLiveCardPeriods(newLivePeriods);

      // Backend verileri gelir gelmez KPI kartlarını derhal göster (Scraper'ı beklemez!)
      setIsLoading(false);

      // Önbelleği güncelle
      if (typeof window !== 'undefined' && user?.id) {
        localStorage.setItem(userCacheKey, JSON.stringify({
          accounts: newAccounts,
          transactions: newTransactions,
          portfolioItems: newItems,
          portfolioSummary: newPort,
          paymentPlans: newPlans,
          cardPeriods: newPeriods,
          liveCardPeriods: newLivePeriods,
        }));
      }

      // 3. Canlı Piyasa Verilerini Arka Planda Sessizce Çek (KPI kartlarını ASLA bloklamaz)
      fetchLiveMarketRates(initialUsd);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Hesaplanan Metrikler (Sadece Vadesiz Banka Hesapları)
  const totalBankBalance = useMemo(() => {
    return accounts
      .filter((a) => a.accountType === 2) // AccountType.Bank
      .reduce((acc, curr) => acc + curr.currentBalance, 0);
  }, [accounts]);

  // Kredi Kartı: Gerçek Kalan Borç, Yıllık Hacim ve Son Ekstre Ödeme Oranı
  const { actualCreditDebt, yearlyCreditSpending, latestPayRatio } = useMemo(() => {
    // 1. Resmi ekstre dönemlerindeki açık / ödenmemiş borç toplamı
    const unpaidStatementDebt = cardPeriods.reduce((acc, p) => {
      const debt = p.periodDebt || 0;
      const payment = p.totalPayment || 0;
      return acc + (debt > payment ? debt - payment : 0);
    }, 0);

    // 2. Henüz ekstreleşmemiş canlı fişler / ön-ekstre havuzu
    const livePendingDebt = liveCardPeriods.reduce((acc, lp) => acc + (lp.totalExpense || 0), 0);

    const totalActualDebt = unpaidStatementDebt + livePendingDebt;

    // 3. Son ekstre döneminin ödeme oranı
    const latest = cardPeriods.length > 0 ? cardPeriods[0] : null;
    let payRatio = 100;
    if (latest && latest.periodDebt > 0) {
      payRatio = Math.min(100, Math.round((latest.totalPayment / latest.periodDebt) * 100));
    } else if (cardPeriods.length === 0 && accounts.some((a) => a.accountType === 3)) {
      payRatio = 100;
    }

    // 4. Yıllık / Kümülatif Kart Harcama Hacmi (accounts veya ekstre toplamı)
    const fromAccounts = accounts
      .filter((a) => a.accountType === 3)
      .reduce((acc, curr) => acc + Math.abs(curr.currentBalance), 0);
    const fromPeriods = cardPeriods.reduce((acc, p) => acc + (p.totalExpense || 0), 0);
    const yearlySpending = Math.max(fromAccounts, fromPeriods);

    return {
      actualCreditDebt: totalActualDebt,
      yearlyCreditSpending: yearlySpending,
      latestPayRatio: payRatio,
    };
  }, [cardPeriods, liveCardPeriods, accounts]);

  const currentMonthTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((t) => {
      const d = new Date(t.transactionDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [transactions]);

  const monthlyIncome = currentMonthTransactions
    .filter((t) => t.type === TransactionType.Income)
    .reduce((acc, curr) => acc + curr.amount, 0);

  const monthlyExpense = currentMonthTransactions
    .filter((t) => t.type === TransactionType.Expense)
    .reduce((acc, curr) => acc + curr.amount, 0);

  const netCashFlow = monthlyIncome - monthlyExpense;

  // Portföyüm Sayfasıyla %100 Uyumlu Canlı Yatırım Portföyü Özeti
  const effectivePortfolioSummary = useMemo(() => {
    if (portfolioItems && portfolioItems.length > 0) {
      const rate = marketRates.USD > 0 ? marketRates.USD : 48.03;
      const active = portfolioItems.filter((i) => i.isActive);

      const toTry = (it: PortfolioItem) => {
        if (it.currency === 2) return it.currentValue * rate; // Currency.USD
        if (it.currency === 3) return it.currentValue * (rate * 1.08); // Currency.EUR
        return it.currentValue;
      };

      const costToTry = (it: PortfolioItem) => {
        if (it.currency === 2) return it.cost * rate;
        if (it.currency === 3) return it.cost * (rate * 1.08);
        return it.cost;
      };

      const totalCost = active.reduce((acc, it) => acc + costToTry(it), 0);
      const totalVal = active.reduce((acc, it) => acc + toTry(it), 0);
      const profitLoss = totalVal - totalCost;
      const profitPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

      return {
        totalCurrentValueTRY: totalVal,
        totalProfitLossPercent: profitPercent,
      };
    }

    return {
      totalCurrentValueTRY: portfolioSummary?.totalCurrentValueTRY ?? 0,
      totalProfitLossPercent: portfolioSummary?.totalProfitLossPercent ?? 0,
    };
  }, [portfolioItems, portfolioSummary, marketRates.USD]);

  // Ödeme Planlayıcı: Aylık Taban Yaşam Maliyeti (Kira, aidat & düzenli gider tabanı)
  const baseLivingCost = useMemo(() => {
    if (!paymentPlans || paymentPlans.length === 0) return 0;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    let total = 0;

    paymentPlans
      .filter((p) => (p.type === PaymentPlanType.Expense || (p as any).type === 'Expense') && !p.isIncome && !p.isOneTime)
      .forEach((p) => {
        const planDate = new Date(p.firstInstallmentDate);
        const diffMonths = (currentYear - planDate.getFullYear()) * 12 + (currentMonth - planDate.getMonth());
        const count = p.installmentCount || 1;
        if (diffMonths >= 0 && diffMonths < count) {
          total += p.amount;
        }
      });
    return total;
  }, [paymentPlans]);

  // Konsolide Net Servet (Net Worth) = Likit Varlıklar + Yatırım Portföyü - Gerçek Kalan Kart Borcu
  const netWorth = useMemo(() => {
    const liquid = totalBankBalance || 0;
    const portfolio = effectivePortfolioSummary.totalCurrentValueTRY || 0;
    const debt = actualCreditDebt || 0;
    return liquid + portfolio - debt;
  }, [totalBankBalance, effectivePortfolioSummary.totalCurrentValueTRY, actualCreditDebt]);

  // Ödeme Planlayıcı: Nakit Darboğazı (En Riskli Zirve Ayı) İkazı (Önümüzdeki 12 Ay)
  const peakBottleneckMonth = useMemo(() => {
    if (!paymentPlans || paymentPlans.length === 0) return null;
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const now = new Date();
    let peak = { monthLabel: '', totalAmount: 0 };

    for (let i = 0; i < 12; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const targetYear = targetDate.getFullYear();
      const targetMonth = targetDate.getMonth();
      const monthLabel = `${monthNames[targetMonth]} ${String(targetYear).slice(-2)}`;
      let total = 0;

      paymentPlans
        .filter((p) => (p.type === PaymentPlanType.Expense || (p as any).type === 'Expense') && !p.isIncome)
        .forEach((p) => {
          const planDate = new Date(p.firstInstallmentDate);
          const diffMonths = (targetYear - planDate.getFullYear()) * 12 + (targetMonth - planDate.getMonth());
          if (p.isOneTime) {
            if (diffMonths === 0) total += p.amount;
          } else {
            const count = p.installmentCount || 1;
            if (diffMonths >= 0 && diffMonths < count) total += p.amount;
          }
        });

      if (total > peak.totalAmount) {
        peak = { monthLabel, totalAmount: total };
      }
    }
    return peak.totalAmount > 0 ? peak : null;
  }, [paymentPlans]);

  return (
    <div className="space-y-6">
      <Header
        title={user?.fullName ? `Hoş Geldiniz, ${user.fullName}` : 'SpendLog Finansal Yönetim'}
        description="Konsolide varlık, nakit akışı ve harcama dinamiklerinin anlık yönetim merkezi"
        showPrivacyToggle={true}
        actions={
          <div className="flex items-center gap-2.5">
            <LiveClock />

            {/* Hızlı İşlem Açılır Menüsü (Quick Action Hub) */}
            <div className="relative" ref={quickMenuRef}>
              <button
                onClick={() => setIsQuickMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all duration-150 cursor-pointer"
                title="Hızlı Modül İşlemleri"
              >
                <Plus className={`w-4 h-4 transition-transform duration-200 ${isQuickMenuOpen ? 'rotate-45' : ''}`} />
                <span>Hızlı İşlem</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 opacity-80 ${isQuickMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isQuickMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 divide-y divide-slate-800/50">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Hızlı Modül İşlemleri
                  </div>
                  
                  <div className="pt-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsQuickMenuOpen(false);
                        setIsTransactionModalOpen(true);
                      }}
                      className="w-full text-left flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/70 transition group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <ArrowDownRight className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">Gelir / Gider Girişi</p>
                        <p className="text-[10px] text-slate-400">Dashboard üzerinde anında kaydet</p>
                      </div>
                    </button>

                    <Link
                      href="/credit-cards"
                      onClick={() => setIsQuickMenuOpen(false)}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/70 transition group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white group-hover:text-rose-300 transition-colors">Kredi Kartı Harcaması</p>
                        <p className="text-[10px] text-slate-400">Ekstre veya dönem içi kart harcaması</p>
                      </div>
                    </Link>

                    <Link
                      href="/fuel-tracker"
                      onClick={() => setIsQuickMenuOpen(false)}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/70 transition group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Fuel className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors">Akaryakıt Fişi / Km</p>
                        <p className="text-[10px] text-slate-400">Yakıt alımı ve araç km takibi</p>
                      </div>
                    </Link>

                    <Link
                      href="/price-alerts"
                      onClick={() => setIsQuickMenuOpen(false)}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/70 transition group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">Fiyat Alarmı Kur</p>
                        <p className="text-[10px] text-slate-400">Hisse, döviz veya altın hedef alarmı</p>
                      </div>
                    </Link>

                    <Link
                      href="/portfolio"
                      onClick={() => setIsQuickMenuOpen(false)}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/70 transition group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors">Yeni Yatırım Varlığı</p>
                        <p className="text-[10px] text-slate-400">Hisse, fon, emtia veya kripto ekle</p>
                      </div>
                    </Link>

                    <Link
                      href="/payment-planner"
                      onClick={() => setIsQuickMenuOpen(false)}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/70 transition group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors">Ödeme Planı / Taksit</p>
                        <p className="text-[10px] text-slate-400">Gelecek sabit gider veya taksit planı</p>
                      </div>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        }
      />

      {/* Top 6 KPI Metrics (Skeleton veya Precision MoneyAmount) */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          <DashboardCardSkeleton />
          <DashboardCardSkeleton />
          <DashboardCardSkeleton />
          <DashboardCardSkeleton />
          <DashboardCardSkeleton />
          <DashboardCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {/* KPI 1: Konsolide Net Servet (Hero Card) */}
          <div className="bg-gradient-to-b from-indigo-950/50 via-slate-900/90 to-slate-900/90 border border-indigo-500/40 hover:border-indigo-400/70 rounded-2xl p-4 shadow-xl shadow-indigo-500/10 transition-all duration-200 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 rounded-full blur-xl pointer-events-none"></div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Konsolide Net Servet</span>
              </span>
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-white mt-2">
              <MoneyAmount amount={netWorth} highlightProfitLoss className="text-xl" />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block truncate">
              Likit + Portföy {actualCreditDebt > 0 ? '− Güncel Borç' : '(Borçsuz)'}
            </span>
          </div>

          {/* KPI 2: Toplam Likit Varlık (Vadesiz Banka) - Link to /accounts */}
          <Link
            href="/accounts"
            className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 shadow-xl transition-all duration-200 group block cursor-pointer"
            title="Banka ve Nakit Hesapları Yönetimi"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Likit Varlıklar</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Landmark className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl font-bold text-white mt-2">
              <MoneyAmount amount={totalBankBalance} className="text-xl" />
            </div>
            <span className="text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors mt-1 block truncate">
              Vadesiz Banka Hesapları
            </span>
          </Link>

          {/* KPI 3: Yatırım Portföy Değeri - Link to /portfolio */}
          <Link
            href="/portfolio"
            className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-4 shadow-xl transition-all duration-200 group block cursor-pointer"
            title="Yatırım Portföyüm & Varlıklarım"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Yatırım Portföyü</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl font-bold text-indigo-400 mt-2">
              <MoneyAmount
                amount={effectivePortfolioSummary.totalCurrentValueTRY}
                className="text-xl text-indigo-400"
              />
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold mt-1 block truncate">
              {effectivePortfolioSummary.totalCurrentValueTRY > 0
                ? `${effectivePortfolioSummary.totalProfitLossPercent >= 0 ? '+' : ''}%${effectivePortfolioSummary.totalProfitLossPercent.toFixed(2)} Getiri`
                : '0 Aktif Yatırım'}
            </span>
          </Link>

          {/* KPI 4: Güncel Kart Borcu & Yıllık Hacim - Link to /credit-cards */}
          <Link
            href="/credit-cards"
            className={`bg-slate-900/80 border rounded-2xl p-4 shadow-xl transition-all duration-200 group block cursor-pointer ${
              actualCreditDebt > 0
                ? 'border-slate-800 hover:border-rose-500/40 hover:shadow-rose-500/10'
                : 'border-slate-800 hover:border-emerald-500/40 hover:shadow-emerald-500/10'
            }`}
            title="Kredi Kartları & Ekstre Yönetimi"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                Güncel Kart Borcu
              </span>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                  actualCreditDebt > 0
                    ? 'bg-rose-500/10 text-rose-400'
                    : 'bg-emerald-500/10 text-emerald-400'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <div className="text-xl font-bold">
                <MoneyAmount
                  amount={actualCreditDebt}
                  className={`text-xl ${actualCreditDebt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}
                />
              </div>
              <span
                className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full border leading-none flex items-center gap-1 font-mono ${
                  actualCreditDebt === 0
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : latestPayRatio > 0
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                }`}
              >
                {actualCreditDebt === 0 ? <CheckCircle2 className="w-2.5 h-2.5" /> : null}
                %{latestPayRatio} Ödendi
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors mt-1.5 pt-1 border-t border-slate-800/60">
              <span className="truncate">Yıllık Harcama:</span>
              <MoneyAmount
                amount={yearlyCreditSpending}
                decimals={0}
                className="text-[10px] font-mono text-slate-300 font-semibold"
              />
            </div>
          </Link>

          {/* KPI 5: Aylık Net Nakit Akışı - Link to /transactions */}
          <Link
            href="/transactions"
            className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 shadow-xl transition-all duration-200 group block cursor-pointer"
            title="Gelir ve Gider İşlem Hareketleri"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Aylık Nakit Akışı</span>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                  netCashFlow >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}
              >
                {netCashFlow >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              </div>
            </div>
            <div className="text-xl font-bold mt-2">
              <MoneyAmount
                amount={netCashFlow}
                showSign
                highlightProfitLoss
                className="text-xl"
              />
            </div>
            <span className="text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors mt-1 block truncate">
              +{monthlyIncome.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} / -{monthlyExpense.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
            </span>
          </Link>

          {/* KPI 6: Aylık Taban Yaşam Maliyeti & Nakit Darboğazı - Link to /payment-planner */}
          <Link
            href="/payment-planner"
            className="bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-4 shadow-xl transition-all duration-200 group block cursor-pointer"
            title="Ödeme Planlayıcı & Nakit Akışı Projeksiyonu'na git"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Taban Yaşam</span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Home className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl font-bold text-blue-400 mt-2">
              <MoneyAmount amount={baseLivingCost} className="text-xl text-blue-400" />
            </div>
            {peakBottleneckMonth ? (
              <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1 mt-1 truncate" title={`En Yüksek Nakit Çıkışı: ${peakBottleneckMonth.monthLabel} (${peakBottleneckMonth.totalAmount.toLocaleString('tr-TR')} ₺)`}>
                <AlertTriangle className="w-3 h-3 shrink-0 text-amber-400" />
                <span>Zirve: {peakBottleneckMonth.monthLabel}</span>
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors mt-1 block truncate">
                Kira, aidat & sabit taban
              </span>
            )}
          </Link>
        </div>
      )}

      {/* Ödeme Planlayıcı Nakit Darboğazı (Zirve Ayı) İkazı Bandı */}
      {peakBottleneckMonth && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3 px-4 shadow-lg text-xs backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-amber-300">Nakit Akışı Darboğazı (Zirve Ayı) İkazı</span>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] px-2 py-0.5 rounded-md font-mono font-bold leading-none">
                  {peakBottleneckMonth.monthLabel}
                </span>
              </div>
              <p className="text-slate-300 text-[11px] mt-0.5">
                Önümüzdeki 12 ay içinde kümülatif nakit çıkışının en yoğun olduğu tepe noktası{' '}
                <strong className="text-white font-mono">{peakBottleneckMonth.monthLabel}</strong> ayında ({isValuesHidden ? '*** ₺' : `${peakBottleneckMonth.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 0 })} ₺`}) olarak öngörülmektedir.
              </p>
            </div>
          </div>
          <Link
            href="/payment-planner"
            className="self-end sm:self-auto flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Projeksiyonda İncele</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Canlı Piyasa Akışı (USD, EUR, Gram Altın, Bitcoin) - Link to /markets */}
      <Link
        href="/markets"
        className="bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xl backdrop-blur-md transition-all group cursor-pointer block"
        title="Canlı Piyasa Fiyatları ve Grafikler"
      >
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-2.5 h-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
          </div>
          <span className="font-bold text-white tracking-wide text-xs group-hover:text-indigo-300 transition-colors">Canlı Piyasa Akışı:</span>
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline-block">({lastSyncTime})</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-mono text-xs">
          <div className="bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800/80 group-hover:border-slate-700 transition">
            <span className="text-slate-500 mr-1.5 font-sans font-semibold">USD/TRY:</span>
            <span className="font-bold text-white tracking-tight">{marketRates.USD?.toFixed(2)} ₺</span>
          </div>
          <div className="bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800/80 group-hover:border-slate-700 transition">
            <span className="text-slate-500 mr-1.5 font-sans font-semibold">EUR/TRY:</span>
            <span className="font-bold text-white tracking-tight">{marketRates.EUR?.toFixed(2)} ₺</span>
          </div>
          <div className="bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800/80 group-hover:border-slate-700 transition">
            <span className="text-slate-500 mr-1.5 font-sans font-semibold">Gram Altın:</span>
            <span className="font-bold text-amber-400 tracking-tight">{marketRates.Gold?.toLocaleString('tr-TR')} ₺</span>
          </div>
          <div className="bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800/80 group-hover:border-slate-700 transition">
            <span className="text-slate-500 mr-1.5 font-sans font-semibold">Bitcoin:</span>
            <span className="font-bold text-emerald-400 tracking-tight">${marketRates.BTC?.toLocaleString('en-US')}</span>
          </div>
          <div className="text-indigo-400 text-xs font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform pl-1">
            <span>Piyasalar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </Link>

      {/* Dashboard Üzerinde Hızlı İşlem Modalı */}
      <QuickTransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSuccess={fetchDashboardData}
        initialAccounts={accounts}
      />
    </div>
  );
}
