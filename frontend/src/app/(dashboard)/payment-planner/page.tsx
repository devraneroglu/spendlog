'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/axios';
import {
  PaymentPlan,
  PaymentPlanType,
  PlanCategory,
  SmartRecurringSuggestion,
  HorizonMonthData,
} from '@/types/payment-plan';
import { Transaction, Category, CategoryType } from '@/types/finance';
import { CreditCardExpense } from '@/types/credit-card';
import { useAuthStore } from '@/store/auth-store';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { formatLocalDateToInput, toSafeApiDateString } from '@/lib/date-utils';
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Loader2,
  X,
  Sparkles,
  ShieldAlert,
  PiggyBank,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Car,
  Home,
  Receipt,
  CreditCard,
  Target,
  Clock,
  Maximize2,
  Minimize2,
  Layers,
  TrendingUp,
  ArrowRight,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

type HorizonZoom = '3M' | '6M' | '1Y' | '2Y';
type HorizonChartType = 'stacked-bar' | 'area' | 'line';

interface PlanCategoryInfo {
  categoryId?: number | null;
  categoryName: string;
  subCategoryId?: number | null;
  subCategoryName?: string;
  badgeLabel: string;
  isLivingExpense: boolean;
  isVehicleOrMilestone: boolean;
}

export default function PaymentPlannerPage() {
  const isValuesHidden = useAuthStore((state) => state.isValuesHidden);
  const toast = useToast();

  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ccExpenses, setCcExpenses] = useState<CreditCardExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'RADAR' | 'LIST'>('RADAR');

  // Horizon Zoom State
  const [horizonZoom, setHorizonZoom] = useState<HorizonZoom>('1Y');

  // Horizon Chart Type State (Öndeğer: 'area')
  const [chartType, setChartType] = useState<HorizonChartType>('area');

  // Horizon Chart Tam Ekran & Kategori Hover State'leri
  const [isHorizonFullscreen, setIsHorizonFullscreen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

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
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(formatLocalDateToInput());
  const [installmentCount, setInstallmentCount] = useState('6');
  const [isOneTime, setIsOneTime] = useState(false);
  const [type, setType] = useState<PaymentPlanType>(PaymentPlanType.Expense);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Discovery Engine States (Kategori Analizi vs Otomatik Keşif)
  const [discoveryTab, setDiscoveryTab] = useState<'CATEGORY' | 'AUTO'>('CATEGORY');
  const [explorerCategoryId, setExplorerCategoryId] = useState<number | ''>('');
  const [explorerSubCategoryId, setExplorerSubCategoryId] = useState<number | ''>('');
  const [explorerRange, setExplorerRange] = useState<3 | 6 | 12>(3);

  // Available SubCategories based on selected Category
  const availableSubCategories = useMemo(() => {
    if (!selectedCategoryId) return [];
    const parent = categories.find((c) => c.id === Number(selectedCategoryId));
    return parent?.subCategories || [];
  }, [categories, selectedCategoryId]);

  // Fetch all related data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [plansRes, txRes, ccRes, catRes] = await Promise.allSettled([
        api.get<PaymentPlan[]>('/api/paymentplans'),
        api.get<Transaction[]>('/api/transactions'),
        api.get<CreditCardExpense[]>('/api/creditcardexpenses'),
        api.get<Category[]>('/api/categories'),
      ]);

      if (plansRes.status === 'fulfilled' && plansRes.value.data) {
        setPlans(plansRes.value.data);
      }
      if (txRes.status === 'fulfilled' && txRes.value.data) {
        setTransactions(txRes.value.data);
      }
      if (ccRes.status === 'fulfilled' && ccRes.value.data) {
        setCcExpenses(ccRes.value.data);
      }
      if (catRes.status === 'fulfilled' && catRes.value.data) {
        setCategories(catRes.value.data);
      }
    } catch (err) {
      console.error('Failed to fetch payment planner data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ESC tuşu ile Nakit Projeksiyonu tam ekrandan çıkma
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isHorizonFullscreen) {
        setIsHorizonFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHorizonFullscreen]);

  // Helper to parse Category and SubCategory from plan
  const getPlanCategoryInfo = (p: PaymentPlan): PlanCategoryInfo => {
    let categoryName = 'Genel';
    let subCategoryName: string | undefined = undefined;
    let categoryId: number | null = null;
    let subCategoryId: number | null = null;

    // Check meta in description: [Cat:Name > SubName|id:X|sub:Y]
    if (p.description) {
      const metaMatch = p.description.match(/\[Cat:(.*?)(?: > (.*?))?\|id:(\d+)(?:\|sub:(\d+))?\]/);
      if (metaMatch) {
        categoryName = metaMatch[1] || 'Genel';
        subCategoryName = metaMatch[2] || undefined;
        categoryId = metaMatch[3] ? Number(metaMatch[3]) : null;
        subCategoryId = metaMatch[4] ? Number(metaMatch[4]) : null;
      } else {
        // Old format: [Kira & Konut] or similar
        const oldMatch = p.description.match(/^\[(.*?)\]/);
        if (oldMatch && oldMatch[1]) {
          categoryName = oldMatch[1];
        }
      }
    }

    // Match against real categories if categoryId is found
    if (categoryId && categories.length > 0) {
      const realCat = categories.find((c) => c.id === categoryId);
      if (realCat) {
        categoryName = realCat.name;
        if (subCategoryId && realCat.subCategories) {
          const realSub = realCat.subCategories.find((s) => s.id === subCategoryId);
          if (realSub) subCategoryName = realSub.name;
        }
      }
    }

    // Fallback keyword detection for older/unlabeled records
    const searchTarget = `${categoryName} ${subCategoryName || ''} ${p.name} ${p.description || ''}`.toLowerCase();

    const isLivingExpense =
      searchTarget.includes('kira') ||
      searchTarget.includes('konut') ||
      searchTarget.includes('aidat') ||
      searchTarget.includes('fatura') ||
      searchTarget.includes('elektrik') ||
      searchTarget.includes('su ') ||
      searchTarget.includes('gaz') ||
      searchTarget.includes('turkcell') ||
      searchTarget.includes('vodafone') ||
      searchTarget.includes('telekom') ||
      searchTarget.includes('internet') ||
      searchTarget.includes('abonelik') ||
      searchTarget.includes('netflix') ||
      searchTarget.includes('spotify');

    const isVehicleOrMilestone =
      searchTarget.includes('araç') ||
      searchTarget.includes('arac') ||
      searchTarget.includes('bakım') ||
      searchTarget.includes('bakim') ||
      searchTarget.includes('kasko') ||
      searchTarget.includes('sigorta') ||
      searchTarget.includes('muayene') ||
      searchTarget.includes('milestone') ||
      searchTarget.includes('tatil') ||
      searchTarget.includes('hedef');

    const badgeLabel = subCategoryName ? `${categoryName} › ${subCategoryName}` : categoryName;

    return {
      categoryId,
      categoryName,
      subCategoryId,
      subCategoryName,
      badgeLabel,
      isLivingExpense,
      isVehicleOrMilestone,
    };
  };

  // Sistemdeki Gider Ana Kategorileri (1-Gelir kesinlikle hariç)
  const expenseCategories = useMemo(() => {
    return categories.filter(
      (c) => !c.parentCategoryId && (c.type === CategoryType.Expense || c.type === CategoryType.Both || !c.type)
    );
  }, [categories]);

  // Seçilen Kategoriye ait Alt Kategoriler (Explorer)
  const effectiveExplorerCategoryId = useMemo(() => {
    if (explorerCategoryId) return explorerCategoryId;
    if (expenseCategories.length > 0) return expenseCategories[0].id;
    return '';
  }, [explorerCategoryId, expenseCategories]);

  const availableExplorerSubCategories = useMemo(() => {
    if (!effectiveExplorerCategoryId) return [];
    const parent = categories.find((c) => c.id === Number(effectiveExplorerCategoryId));
    return parent?.subCategories || [];
  }, [categories, effectiveExplorerCategoryId]);

  // Kategori & Ekstre Analiz Motoru (Dinamik Ortalama ve Son Hareketler)
  const explorerStats = useMemo(() => {
    if (!effectiveExplorerCategoryId || expenseCategories.length === 0) {
      return {
        categoryName: 'Genel',
        subCategoryName: undefined,
        targetCatId: '' as number | '',
        targetSubId: '' as number | '',
        totalSpent: 0,
        txCount: 0,
        avgMonthly: 0,
        recentItems: [] as { description: string; date: string; amount: number; source: 'cc' | 'tx' }[],
      };
    }

    const selectedCat = categories.find((c) => c.id === Number(effectiveExplorerCategoryId));
    const catName = selectedCat?.name || 'Genel';

    const selectedSub = selectedCat?.subCategories?.find(
      (s) => s.id === Number(explorerSubCategoryId)
    );
    const subName = selectedSub?.name;

    // Seçilen analiz dönemine (Son 3, 6, 12 ay) göre başlangıç tarihi (Cutoff)
    const now = new Date();
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - explorerRange + 1, 1);

    const parseSafeDate = (dateVal?: string | null): Date | null => {
      if (!dateVal) return null;
      const d = new Date(dateVal);
      return isNaN(d.getTime()) ? null : d;
    };

    // Filter credit card expenses with date threshold & category matching
    const matchedCc = ccExpenses.filter((e) => {
      if (!e.isExpense || !e.tutar) return false;

      const d = parseSafeDate(e.tarih);
      if (d && d < cutoffDate) return false;

      const mainMatch =
        (effectiveExplorerCategoryId && Number(e.categoryId) === Number(effectiveExplorerCategoryId)) ||
        (e.categoryName && e.categoryName.trim().toLowerCase() === catName.trim().toLowerCase()) ||
        (e.mainCategory && e.mainCategory.trim().toLowerCase() === catName.trim().toLowerCase());

      if (!mainMatch) return false;

      if (explorerSubCategoryId && subName) {
        const subMatch =
          (e.subCategoryId != null && Number(e.subCategoryId) === Number(explorerSubCategoryId)) ||
          (e.subCategoryName && e.subCategoryName.trim().toLowerCase() === subName.trim().toLowerCase()) ||
          (e.category && e.category.trim().toLowerCase() === subName.trim().toLowerCase());
        return !!subMatch;
      }
      return true;
    });

    // Filter transactions with date threshold & category matching
    const matchedTx = transactions.filter((t) => {
      if (t.amount <= 0) return false;

      const d = parseSafeDate(t.transactionDate);
      if (d && d < cutoffDate) return false;

      const mainMatch =
        (effectiveExplorerCategoryId && Number(t.categoryId) === Number(effectiveExplorerCategoryId)) ||
        (t.categoryName && t.categoryName.trim().toLowerCase() === catName.trim().toLowerCase());

      if (!mainMatch) return false;

      if (explorerSubCategoryId && subName) {
        const subMatch =
          (t.subCategoryId != null && Number(t.subCategoryId) === Number(explorerSubCategoryId)) ||
          (t.subCategoryName && t.subCategoryName.trim().toLowerCase() === subName.trim().toLowerCase());
        return !!subMatch;
      }
      return true;
    });

    const allMatched: { description: string; date: string; amount: number; source: 'cc' | 'tx' }[] = [
      ...matchedCc.map((c) => ({
        description: c.description || catName,
        date: c.tarih || '',
        amount: Math.abs(c.tutar),
        source: 'cc' as const,
      })),
      ...matchedTx.map((t) => ({
        description: t.description || catName,
        date: t.transactionDate || '',
        amount: t.amount,
        source: 'tx' as const,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalSpent = allMatched.reduce((sum, item) => sum + item.amount, 0);
    const txCount = allMatched.length;
    const avgMonthly = txCount > 0 ? Math.round(totalSpent / explorerRange) : 0;
    const recentItems = allMatched.slice(0, 30);

    return {
      categoryName: catName,
      subCategoryName: subName,
      targetCatId: effectiveExplorerCategoryId,
      targetSubId: explorerSubCategoryId,
      totalSpent,
      txCount,
      avgMonthly,
      recentItems,
    };
  }, [
    effectiveExplorerCategoryId,
    explorerSubCategoryId,
    explorerRange,
    categories,
    expenseCategories,
    ccExpenses,
    transactions,
  ]);

  // 1. SMART RECURRING DISCOVERY ENGINE (Kira, Fatura, Düzenli Ödeme Tespiti)
  const smartSuggestions = useMemo<SmartRecurringSuggestion[]>(() => {
    const suggestions: SmartRecurringSuggestion[] = [];
    const lowerPlanNames = plans.map((p) => p.name.toLowerCase());

    const patterns = [
      { key: 'kira', name: 'Ev Kirası', catMatch: 'Konut', subMatch: 'Kira' },
      { key: 'aidat', name: 'Apartman / Site Aidatı', catMatch: 'Konut', subMatch: 'Aidat' },
      { key: 'turkcell', name: 'Turkcell Faturası', catMatch: 'Dijital', subMatch: 'İletişim' },
      { key: 'vodafone', name: 'Vodafone Faturası', catMatch: 'Dijital', subMatch: 'İletişim' },
      { key: 'telekom', name: 'Türk Telekom Faturası', catMatch: 'Dijital', subMatch: 'İletişim' },
      { key: 'superonline', name: 'Superonline İnternet', catMatch: 'Dijital', subMatch: 'İnternet' },
      { key: 'enerjisa', name: 'Elektrik Faturası (Enerjisa)', catMatch: 'Konut', subMatch: 'Elektrik' },
      { key: 'elektrik', name: 'Elektrik Faturası', catMatch: 'Konut', subMatch: 'Elektrik' },
      { key: 'iski', name: 'Su Faturası (İSKİ)', catMatch: 'Konut', subMatch: 'Su' },
      { key: 'igdas', name: 'Doğalgaz Faturası (İGDAŞ)', catMatch: 'Konut', subMatch: 'Doğalgaz' },
      { key: 'netflix', name: 'Netflix Aboneliği', catMatch: 'Dijital', subMatch: 'Abonelik' },
      { key: 'spotify', name: 'Spotify Aboneliği', catMatch: 'Dijital', subMatch: 'Abonelik' },
      { key: 'kasko', name: 'Yıllık Araç Kaskosu', catMatch: 'Ulaşım', subMatch: 'Kasko' },
      { key: 'sigorta', name: 'Trafik Sigortası', catMatch: 'Ulaşım', subMatch: 'Sigorta' },
      { key: 'bakim', name: 'Periyodik Araç Bakımı', catMatch: 'Ulaşım', subMatch: 'Bakım' },
      { key: 'bakım', name: 'Periyodik Araç Bakımı', catMatch: 'Ulaşım', subMatch: 'Bakım' },
    ];

    patterns.forEach((pat, idx) => {
      const alreadyExists = lowerPlanNames.some((pName) => pName.includes(pat.key));
      if (alreadyExists) return;

      const matchedTx = transactions.filter(
        (t) => (t.description || '').toLowerCase().includes(pat.key) && t.amount > 0
      );

      const matchedCc = ccExpenses.filter(
        (c) => (c.description || '').toLowerCase().includes(pat.key) && Math.abs(c.tutar) > 0
      );

      // Yalnızca Gider kategorileri arasından eşleştir
      let matchedCategory = expenseCategories.find((c) =>
        c.name.toLowerCase().includes(pat.catMatch.toLowerCase())
      );
      let matchedSubCategory: Category | undefined = undefined;
      if (matchedCategory && matchedCategory.subCategories) {
        matchedSubCategory = matchedCategory.subCategories.find((s) =>
          s.name.toLowerCase().includes(pat.subMatch.toLowerCase())
        );
      }
      if (!matchedCategory && expenseCategories.length > 0) {
        matchedCategory = expenseCategories[0];
      }

      if (matchedTx.length > 0) {
        const latest = matchedTx[0];
        const avg = matchedTx.reduce((sum, t) => sum + t.amount, 0) / matchedTx.length;
        suggestions.push({
          id: `tx-${idx}`,
          name: pat.name,
          category: PlanCategory.Rent,
          categoryId: matchedCategory?.id || null,
          categoryName: matchedCategory?.name || 'Genel',
          subCategoryId: matchedSubCategory?.id || null,
          subCategoryName: matchedSubCategory?.name,
          monthlyAmount: Math.round(avg),
          lastOccurrenceDate: latest.transactionDate,
          sampleDescription: latest.description || pat.name,
          source: 'transaction',
        });
      } else if (matchedCc.length > 0) {
        const latest = matchedCc[0];
        const avg = matchedCc.reduce((sum, c) => sum + Math.abs(c.tutar), 0) / matchedCc.length;
        suggestions.push({
          id: `cc-${idx}`,
          name: pat.name,
          category: PlanCategory.Bill,
          categoryId: matchedCategory?.id || null,
          categoryName: matchedCategory?.name || 'Genel',
          subCategoryId: matchedSubCategory?.id || null,
          subCategoryName: matchedSubCategory?.name,
          monthlyAmount: Math.round(avg),
          lastOccurrenceDate: latest.tarih,
          sampleDescription: latest.description || pat.name,
          source: 'creditcard',
        });
      }
    });

    return suggestions.slice(0, 4);
  }, [plans, transactions, ccExpenses, expenseCategories]);

  // 1.1. Kuşbakışı Radar için Kategoriler ve Renk Paleti (Yalnızca Aktif Planlardaki Kategoriler)
  const topCategoriesForChart = useMemo(() => {
    const modernPalette = [
      '#3b82f6', // Mavi
      '#6366f1', // Indigo
      '#10b981', // Emerald
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#f59e0b', // Amber
      '#8b5cf6', // Purple
      '#f97316', // Orange
      '#14b8a6', // Teal
      '#e11d48', // Rose
      '#84cc16', // Lime
      '#a855f7', // Violet
      '#64748b', // Slate
    ];

    const parseCategoryNumber = (name: string): number => {
      const match = name.match(/^(\d+)/);
      if (match) return parseInt(match[1], 10);
      const catObj = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (catObj && typeof catObj.displayOrder === 'number') return catObj.displayOrder;
      return 999;
    };

    // Yalnızca aktif gider planlarında yer alan kategorileri topla
    const activeCatSet = new Set<string>();
    plans
      .filter((p) => p.type === PaymentPlanType.Expense && p.amount > 0)
      .forEach((p) => {
        const info = getPlanCategoryInfo(p);
        const name = info.categoryName || 'Genel';
        activeCatSet.add(name);
      });

    // 1-, 2-, 3- doğal numarasına göre sırala
    const sortedNames = Array.from(activeCatSet).sort((a, b) => {
      const numA = parseCategoryNumber(a);
      const numB = parseCategoryNumber(b);
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b, 'tr-TR');
    });

    // Renkleri ve ikonları eşle
    return sortedNames.map((name, idx) => {
      const realCat = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
      return {
        name,
        color: realCat?.color || modernPalette[idx % modernPalette.length],
        icon: realCat?.icon || 'folder',
      };
    });
  }, [categories, plans]);

  // 2. HORIZON TIMELINE PROJECTION (12 - 24 Aylık Nakit Akışı Projeksiyonu)
  const horizonData = useMemo(() => {
    const monthCount = horizonZoom === '3M' ? 3 : horizonZoom === '6M' ? 6 : horizonZoom === '1Y' ? 12 : 24;
    const now = new Date();
    const result: any[] = [];

    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

    for (let i = 0; i < monthCount; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const targetYear = targetDate.getFullYear();
      const targetMonth = targetDate.getMonth();
      const monthKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
      const monthLabel = `${monthNames[targetMonth]} ${String(targetYear).slice(-2)}`;

      let baseAmount = 0;
      let installmentAmount = 0;
      let milestoneAmount = 0;
      const items: HorizonMonthData['items'] = [];
      const breakdown: {
        planId: number;
        planName: string;
        categoryName: string;
        subCategoryName?: string;
        amount: number;
        color: string;
        icon: string;
      }[] = [];

      // Her kategori için sütun değerini 0 başlat
      const categoryAmounts: Record<string, number> = {};
      topCategoriesForChart.forEach((cat) => {
        categoryAmounts[cat.name] = 0;
      });

      plans
        .filter((p) => p.type === PaymentPlanType.Expense)
        .forEach((p) => {
          const planDate = new Date(p.firstInstallmentDate);
          const planYear = planDate.getFullYear();
          const planMonth = planDate.getMonth();
          const catInfo = getPlanCategoryInfo(p);

          const diffMonths = (targetYear - planYear) * 12 + (targetMonth - planMonth);

          let isPlanActive = false;
          let monthly = 0;

          if (p.isOneTime) {
            // Tek seferlik ödeme
            if (diffMonths === 0) {
              isPlanActive = true;
              monthly = p.amount;
              if (catInfo.isVehicleOrMilestone || p.amount >= 10000) {
                milestoneAmount += p.amount;
                items.push({ name: p.name, amount: p.amount, type: 'milestone' });
              } else {
                baseAmount += p.amount;
                items.push({ name: p.name, amount: p.amount, type: 'base' });
              }
            }
          } else {
            // Yinelenen ödeme
            const count = p.installmentCount || 1;
            if (diffMonths >= 0 && diffMonths < count) {
              isPlanActive = true;
              monthly = p.amount;
              if (catInfo.isLivingExpense) {
                baseAmount += monthly;
                items.push({ name: p.name, amount: monthly, type: 'base' });
              } else {
                installmentAmount += monthly;
                items.push({ name: p.name, amount: monthly, type: 'installment' });
              }
            }
          }

          if (isPlanActive && monthly > 0) {
            const catName = catInfo.categoryName || 'Genel';
            categoryAmounts[catName] = (categoryAmounts[catName] || 0) + monthly;

            const matchedCat = topCategoriesForChart.find((c) => c.name === catName);
            breakdown.push({
              planId: p.id,
              planName: p.name,
              categoryName: catName,
              subCategoryName: catInfo.subCategoryName,
              amount: monthly,
              color: matchedCat?.color || '#6366f1',
              icon: matchedCat?.icon || 'folder',
            });
          }
        });

      const totalAmount = Math.round(baseAmount + installmentAmount + milestoneAmount);

      result.push({
        monthKey,
        monthLabel,
        baseAmount: Math.round(baseAmount),
        installmentAmount: Math.round(installmentAmount),
        milestoneAmount: Math.round(milestoneAmount),
        totalAmount,
        items,
        breakdown,
        ...categoryAmounts,
      });
    }

    return result;
  }, [plans, categories, topCategoriesForChart, horizonZoom]);

  // 3. SINKING FUND (Akıllı Kumbara) HESAPLAMALARI
  const sinkingFundItems = useMemo(() => {
    const now = new Date();
    return plans
      .filter((p) => {
        const catInfo = getPlanCategoryInfo(p);
        return (
          p.type === PaymentPlanType.Expense &&
          p.isOneTime &&
          (catInfo.isVehicleOrMilestone || p.amount >= 10000)
        );
      })
      .map((p) => {
        const targetDate = new Date(p.firstInstallmentDate);
        const diffMonths =
          (targetDate.getFullYear() - now.getFullYear()) * 12 + (targetDate.getMonth() - now.getMonth());
        const remainingMonths = Math.max(diffMonths, 1);
        const monthlyAllocation = p.amount / remainingMonths;
        const catInfo = getPlanCategoryInfo(p);

        return {
          plan: p,
          categoryInfo: catInfo,
          targetDate,
          remainingMonths,
          monthlyAllocation,
          isUrgent: remainingMonths <= 2,
        };
      })
      .sort((a, b) => a.remainingMonths - b.remainingMonths);
  }, [plans, categories]);

  // 4. EXECUTIVE RUNWAY KPI METRİKLERİ
  const kpis = useMemo(() => {
    const currentMonthData = horizonData[0] || {
      baseAmount: 0,
      installmentAmount: 0,
      milestoneAmount: 0,
      totalAmount: 0,
    };

    const baseBurnRate = currentMonthData.baseAmount + currentMonthData.installmentAmount;
    const totalSinkingFundAllocation = sinkingFundItems.reduce((sum, item) => sum + item.monthlyAllocation, 0);
    const totalSafeRunway = baseBurnRate + totalSinkingFundAllocation;

    let peakMonth = horizonData[0] || { monthLabel: '-', totalAmount: 0 };
    horizonData.forEach((m) => {
      if (m.totalAmount > peakMonth.totalAmount) {
        peakMonth = m;
      }
    });

    const annualCommitment = horizonData.slice(0, 12).reduce((sum, m) => sum + m.totalAmount, 0);

    return {
      baseBurnRate,
      totalSinkingFundAllocation,
      totalSafeRunway,
      peakMonth,
      annualCommitment,
    };
  }, [horizonData, sinkingFundItems]);

  const handleOpenModalForExplorer = () => {
    if (!explorerStats.avgMonthly || explorerStats.avgMonthly <= 0) {
      toast.error('Seçilen kategori için hesaplanmış bir harcama ortalaması bulunamadı.');
      return;
    }
    setEditingPlanId(null);
    const planTitle = explorerStats.subCategoryName
      ? `${explorerStats.categoryName} (${explorerStats.subCategoryName})`
      : `${explorerStats.categoryName} Gideri`;
    setName(planTitle);
    setAmount(explorerStats.avgMonthly.toString());
    setFirstInstallmentDate(formatLocalDateToInput());
    setInstallmentCount('6');
    setIsOneTime(false);
    setType(PaymentPlanType.Expense);
    setSelectedCategoryId(explorerStats.targetCatId || '');
    setSelectedSubCategoryId(explorerStats.targetSubId || '');
    setDescription(
      `Ekstre ve hesap geçmişinden ${explorerRange} aylık harcama ortalaması (${explorerStats.avgMonthly.toLocaleString('tr-TR')} ₺/ay) baz alınarak oluşturuldu.`
    );
    setIsModalOpen(true);
  };

  const handleOpenModalForSuggestion = (sugg: SmartRecurringSuggestion) => {
    setEditingPlanId(null);
    setName(sugg.name);
    setAmount(sugg.monthlyAmount.toString());
    setFirstInstallmentDate(formatLocalDateToInput());
    setInstallmentCount('6');
    setIsOneTime(false);
    setType(PaymentPlanType.Expense);
    setSelectedCategoryId(sugg.categoryId || '');
    setSelectedSubCategoryId(sugg.subCategoryId || '');
    setDescription(`Otomatik tespit edilen düzenli ödeme (${sugg.sampleDescription})`);
    setIsModalOpen(true);
  };

  const handleOpenNewModal = () => {
    setEditingPlanId(null);
    setName('');
    setAmount('');
    setFirstInstallmentDate(formatLocalDateToInput());
    setInstallmentCount('6');
    setIsOneTime(false);
    setType(PaymentPlanType.Expense);
    if (categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
      setSelectedSubCategoryId('');
    } else {
      setSelectedCategoryId('');
      setSelectedSubCategoryId('');
    }
    setDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: PaymentPlan) => {
    setEditingPlanId(p.id);
    setName(p.name);
    setAmount(p.amount.toString());
    const dateStr = p.firstInstallmentDate
      ? p.firstInstallmentDate.split('T')[0]
      : formatLocalDateToInput();
    setFirstInstallmentDate(dateStr);
    setInstallmentCount(p.installmentCount ? p.installmentCount.toString() : '1');
    setIsOneTime(p.isOneTime);
    setType(p.type);

    const catInfo = getPlanCategoryInfo(p);
    let matchedCatId: number | '' = catInfo.categoryId || '';
    if (!matchedCatId && catInfo.categoryName) {
      const found = categories.find(
        (c) => c.name.toLowerCase() === catInfo.categoryName.toLowerCase()
      );
      if (found) matchedCatId = found.id;
    }
    setSelectedCategoryId(matchedCatId);

    let matchedSubId: number | '' = catInfo.subCategoryId || '';
    if (!matchedSubId && matchedCatId && catInfo.subCategoryName) {
      const parent = categories.find((c) => c.id === matchedCatId);
      const foundSub = parent?.subCategories?.find(
        (s) => s.name.toLowerCase() === catInfo.subCategoryName?.toLowerCase()
      );
      if (foundSub) matchedSubId = foundSub.id;
    }
    setSelectedSubCategoryId(matchedSubId);

    const cleanDesc = p.description ? p.description.replace(/\[Cat:.*?\]/, '').trim() : '';
    setDescription(cleanDesc);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const finalCount = isOneTime ? 1 : parseInt(installmentCount) || 1;
      const parsedAmount = parseFloat(amount) || 0;

      // Find Category & SubCategory names
      const selectedCategory = categories.find((c) => c.id === Number(selectedCategoryId));
      const selectedSub = selectedCategory?.subCategories?.find(
        (s) => s.id === Number(selectedSubCategoryId)
      );

      const catLabel = selectedCategory?.name || 'Genel';
      const subLabel = selectedSub?.name ? ` > ${selectedSub.name}` : '';
      const catMeta = `[Cat:${catLabel}${subLabel}|id:${selectedCategoryId || ''}|sub:${selectedSubCategoryId || ''}]`;
      const formattedDescription = [catMeta, description].filter(Boolean).join(' ').trim();

      if (editingPlanId) {
        await api.put(`/api/paymentplans/${editingPlanId}`, {
          id: editingPlanId,
          name,
          amount: parsedAmount,
          firstInstallmentDate: toSafeApiDateString(firstInstallmentDate),
          installmentCount: finalCount,
          isOneTime,
          type,
          isIncome: type === PaymentPlanType.Income,
          description: formattedDescription,
        });
        toast.success(`"${name}" ödeme planı başarıyla güncellendi.`);
      } else {
        await api.post('/api/paymentplans', {
          name,
          amount: parsedAmount,
          firstInstallmentDate: toSafeApiDateString(firstInstallmentDate),
          installmentCount: finalCount,
          isOneTime,
          type,
          isIncome: type === PaymentPlanType.Income,
          description: formattedDescription,
        });
        toast.success('Ödeme planı başarıyla oluşturuldu.');
      }

      setIsModalOpen(false);
      setEditingPlanId(null);
      setName('');
      setAmount('');
      setDescription('');
      fetchData();
    } catch (err: any) {
      console.error('Failed to save payment plan', err);
      toast.error('Ödeme planı kaydedilirken hata oluştu: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number, planName: string) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Ödeme Planını Sil',
      message: `"${planName}" ödeme planını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      onConfirm: async () => {
        try {
          await api.delete(`/api/paymentplans/${id}`);
          toast.success(`"${planName}" ödeme planı başarıyla silindi.`);
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          fetchData();
        } catch (err: any) {
          console.error('Failed to delete payment plan', err);
          toast.error('Ödeme planı silinirken hata oluştu: ' + (err.response?.data?.detail || err.message));
        }
      },
    });
  };

  // 🚀 Kategori - Altkategori Nakit Projeksiyonu Tooltip (Hiyerarşik Kategori & Altkategori Gruplaması)
  const renderHorizonTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const periodTotal = data.totalAmount || 0;

      // Ana Kategori bazında gruplayalım
      const groupMap = new Map<
        string,
        {
          categoryName: string;
          color: string;
          icon: string;
          totalAmount: number;
          subItems: Map<string, number>;
        }
      >();

      (data.breakdown || []).forEach((b: any) => {
        const catName = b.categoryName || 'Genel';
        const subLabel =
          b.subCategoryName ||
          (b.planName && b.planName.trim().toLowerCase() !== catName.trim().toLowerCase()
            ? b.planName.trim()
            : '');

        let group = groupMap.get(catName);
        if (!group) {
          group = {
            categoryName: catName,
            color: b.color || '#6366f1',
            icon: b.icon || 'folder',
            totalAmount: 0,
            subItems: new Map<string, number>(),
          };
          groupMap.set(catName, group);
        }

        group.totalAmount += b.amount;

        if (subLabel) {
          const currentSub = group.subItems.get(subLabel) || 0;
          group.subItems.set(subLabel, currentSub + b.amount);
        }
      });

      const sortedGroups = Array.from(groupMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .map((g) => ({
          ...g,
          subItemsList: Array.from(g.subItems.entries())
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount),
        }));

      return (
        <div className="bg-[#090d16] border border-slate-800 rounded-2xl p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] min-w-[270px] relative z-50 select-none">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <span className="font-bold text-xs text-white">{label}</span>
            <span className="text-xs font-bold text-cyan-400 font-mono">
              {isValuesHidden ? '***' : `${periodTotal.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
            </span>
          </div>
          {sortedGroups.length === 0 ? (
            <p className="text-[11px] text-slate-500 py-1">Bu ay için planlanmış harcama bulunmuyor.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {sortedGroups.map((group, index) => {
                const percent = periodTotal > 0 ? Math.round((group.totalAmount / periodTotal) * 100) : 0;
                const isSelected = hoveredCategory === group.categoryName;
                const hasSubItems = group.subItemsList.length > 0;

                return (
                  <div
                    key={`group-${index}`}
                    className={`rounded-xl transition-all ${
                      isSelected
                        ? 'bg-indigo-500/15 border border-indigo-400/50 p-1.5'
                        : 'p-1 hover:bg-slate-900/50 border border-transparent'
                    }`}
                  >
                    {/* Ana Kategori Başlık Satırı */}
                    <div
                      onMouseEnter={() => setHoveredCategory(group.categoryName)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className="flex items-center justify-between text-xs gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 transition-transform ${
                            isSelected ? 'ring-2 ring-white scale-125 shadow' : ''
                          }`}
                          style={{ backgroundColor: group.color }}
                        />
                        <CategoryIcon
                          name={group.icon}
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color: group.color }}
                        />
                        <span
                          className={`truncate text-xs ${
                            isSelected ? 'text-white font-bold' : 'text-slate-200 font-semibold'
                          }`}
                        >
                          {group.categoryName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-mono">
                        <span className={`text-[10px] ${isSelected ? 'text-cyan-300 font-bold' : 'text-slate-500'}`}>
                          %{percent}
                        </span>
                        <strong className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                          {isValuesHidden
                            ? '***'
                            : `${Number(group.totalAmount).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
                        </strong>
                      </div>
                    </div>

                    {/* Alt Kategori / Harcama Kalemleri (Hiyerarşik Döküm) */}
                    {hasSubItems && (
                      <div className="pl-3.5 pr-1 pt-1.5 pb-0.5 space-y-1 border-l border-slate-800/80 ml-2.5 mt-1">
                        {group.subItemsList.map((sub, sIdx) => (
                          <div
                            key={`sub-${sIdx}`}
                            className="flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            <span className="truncate max-w-[155px] flex items-center gap-1 text-[10.5px]">
                              <span className="text-slate-600">↳</span>
                              <span className="text-slate-300">{sub.name}</span>
                            </span>
                            <span className="font-mono text-[10.5px] font-medium text-slate-300 shrink-0">
                              {isValuesHidden
                                ? '***'
                                : `${Number(sub.amount).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <Header
        title="Ödeme Planlayıcı & Nakit Akışı Projeksiyonu"
        description="Aylık düzenli harcamalar, 12-24 aylık makro nakit akışı projeksiyonu ve akıllı kumbara hedefleri"
        actions={
          <div className="flex items-center gap-3">
            {/* Tab Toggles */}
            <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1">
              <button
                onClick={() => setActiveTab('RADAR')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'RADAR'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Nakit Projeksiyonu & Asistan
              </button>
              <button
                onClick={() => setActiveTab('LIST')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'LIST'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Plan Listesi ({plans.length})
              </button>
            </div>

            <button
              onClick={handleOpenNewModal}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Plan / Milestone Ekle</span>
            </button>
          </div>
        }
      />

      {/* 1. EXECUTIVE RUNWAY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Aylık Taban Yaşam Maliyeti */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Aylık Taban Yaşam Maliyeti</span>
            <Home className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-bold font-mono text-white mt-2">
            {isValuesHidden ? '*** ₺' : `${kpis.baseBurnRate.toLocaleString('tr-TR')} ₺`}
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Kira, aidat & sabit fatura tabanı
          </span>
        </div>

        {/* KPI 2: Aylık Kumbara Hedefi (Sinking Fund) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Aylık Kumbara Hedefi</span>
            <PiggyBank className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-bold font-mono text-amber-400 mt-2">
            {isValuesHidden ? '*** ₺' : `${Math.round(kpis.totalSinkingFundAllocation).toLocaleString('tr-TR')} ₺`}
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Gelecek şok harcamalar için aylık pay
          </span>
        </div>

        {/* KPI 3: En Riskli Zirve Ayı */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">En Riskli Zirve Ayı</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-lg font-bold text-white">{kpis.peakMonth.monthLabel}</span>
            <span className="text-xs font-mono font-semibold text-red-400">
              ({isValuesHidden ? '***' : `${kpis.peakMonth.totalAmount.toLocaleString('tr-TR')} ₺`})
            </span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Projeksiyonda nakit çıkışının tepe noktası
          </span>
        </div>

        {/* KPI 4: 12 Aylık Toplam Taahhüt */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg border-l-4 border-l-cyan-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">12 Aylık Toplam Taahhüt</span>
            <Calendar className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-xl font-bold font-mono text-cyan-400 mt-2">
            {isValuesHidden ? '*** ₺' : `${kpis.annualCommitment.toLocaleString('tr-TR')} ₺`}
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Önümüzdeki 1 yılın kümülatif nakit yükü
          </span>
        </div>
      </div>

      {activeTab === 'RADAR' ? (
        <div className="space-y-6">
          {/* 2. 12 - 24 AYLIK NAKİT AKIŞI PROJEKSİYONU (HORIZON CHART) */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-indigo-400" />
                  <span>12 - 24 Aylık Nakit Akışı Projeksiyonu</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sabit yaşam tabanı, kredi taksitleri ve şok harcamaların (araç bakımı, sigorta) zaman içindeki dağılımı
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                {/* 🚀 GRAFİK TÜRÜ SEÇİCİ (Yığılmış Bar / Alan / Çizgi) */}
                <div className="flex items-center bg-slate-950/80 border border-slate-800 p-0.5 rounded-xl text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setChartType('stacked-bar')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      chartType === 'stacked-bar'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Yığılmış Bar Grafiği (Stacked Bar)"
                  >
                    Yığılmış Bar
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType('area')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      chartType === 'area'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Alan Trend Grafiği (Area)"
                  >
                    Alan (Area)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType('line')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      chartType === 'line'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Çizgi Trend Grafiği (Line)"
                  >
                    Çizgi (Line)
                  </button>
                </div>

                {/* 🎯 KURUMSAL VADE (ZOOM) SEÇİCİ */}
                <div className="flex items-center bg-slate-950/80 border border-slate-800 p-0.5 rounded-xl text-[10px] font-semibold">
                  <span className="text-[10px] text-slate-500 font-bold px-2 uppercase tracking-wider">Vade:</span>
                  {(['3M', '6M', '1Y', '2Y'] as HorizonZoom[]).map((zoom) => (
                    <button
                      key={zoom}
                      type="button"
                      onClick={() => setHorizonZoom(zoom)}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        horizonZoom === zoom
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                      }`}
                    >
                      {zoom === '3M' ? '3 Ay' : zoom === '6M' ? '6 Ay' : zoom === '1Y' ? '1 Yıl' : '2 Yıl'}
                    </button>
                  ))}
                </div>

                {/* 🚀 TAM EKRAN (FULLSCREEN) TETİKLEYİCİ BUTONU */}
                <button
                  type="button"
                  onClick={() => setIsHorizonFullscreen(true)}
                  className="p-1.5 rounded-xl bg-slate-950/80 hover:bg-indigo-600/20 border border-slate-800 hover:border-indigo-500/50 text-slate-400 hover:text-indigo-300 transition-all cursor-pointer shadow-sm group"
                  title="Nakit Akışı Projeksiyonunu Tam Ekran Genişlet"
                >
                  <Maximize2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform text-slate-400 group-hover:text-indigo-400" />
                </button>
              </div>
            </div>

            {/* Recharts Render (Yığılmış Bar / Alan / Çizgi Modu) */}
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'stacked-bar' ? (
                  <BarChart data={horizonData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => (val >= 1000 ? `${Math.round(val / 1000)}k ₺` : `${val} ₺`)}
                    />
                    <Tooltip
                      isAnimationActive={false}
                      cursor={{ fill: 'rgba(99, 102, 241, 0.08)', radius: 8 }}
                      wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }}
                      content={renderHorizonTooltip}
                    />
                    {topCategoriesForChart.map((cat, idx) => {
                      const isSelected = hoveredCategory === cat.name;
                      const isAnySelected = hoveredCategory !== null;
                      const opacity = isSelected ? 1 : isAnySelected ? 0.18 : 1;

                      return (
                        <Bar
                          key={cat.name}
                          dataKey={cat.name}
                          stackId="categories"
                          fill={cat.color}
                          opacity={opacity}
                          isAnimationActive={false}
                          radius={idx === topCategoriesForChart.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        />
                      );
                    })}
                  </BarChart>
                ) : chartType === 'area' ? (
                  <AreaChart data={horizonData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                    <defs>
                      {topCategoriesForChart.map((cat) => (
                        <linearGradient
                          key={`grad-${cat.name}`}
                          id={`grad-${cat.name.replace(/[^a-zA-Z0-9]/g, '')}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="5%" stopColor={cat.color} stopOpacity={0.85} />
                          <stop offset="95%" stopColor={cat.color} stopOpacity={0.12} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => (val >= 1000 ? `${Math.round(val / 1000)}k ₺` : `${val} ₺`)}
                    />
                    <Tooltip isAnimationActive={false} wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }} content={renderHorizonTooltip} />
                    {topCategoriesForChart.map((cat) => {
                      const isSelected = hoveredCategory === cat.name;
                      const isAnySelected = hoveredCategory !== null;
                      const opacity = isSelected ? 1 : isAnySelected ? 0.12 : 0.8;
                      const strokeOpacity = isSelected ? 1 : isAnySelected ? 0.18 : 0.9;
                      const strokeWidth = isSelected ? 3.5 : 1.5;

                      return (
                        <Area
                          key={cat.name}
                          type="monotone"
                          dataKey={cat.name}
                          stackId="1"
                          stroke={cat.color}
                          strokeWidth={strokeWidth}
                          strokeOpacity={strokeOpacity}
                          fill={`url(#grad-${cat.name.replace(/[^a-zA-Z0-9]/g, '')})`}
                          fillOpacity={opacity}
                          isAnimationActive={false}
                          activeDot={
                            isSelected
                              ? { r: 6, stroke: '#ffffff', strokeWidth: 2, fill: cat.color }
                              : { r: 3.5, stroke: cat.color, strokeWidth: 1 }
                          }
                        />
                      );
                    })}
                  </AreaChart>
                ) : (
                  <LineChart data={horizonData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => (val >= 1000 ? `${Math.round(val / 1000)}k ₺` : `${val} ₺`)}
                    />
                    <Tooltip isAnimationActive={false} wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }} content={renderHorizonTooltip} />
                    {topCategoriesForChart.map((cat) => {
                      const isSelected = hoveredCategory === cat.name;
                      const isAnySelected = hoveredCategory !== null;
                      const strokeOpacity = isSelected ? 1 : isAnySelected ? 0.15 : 0.9;
                      const strokeWidth = isSelected ? 3.5 : 2;

                      return (
                        <Line
                          key={cat.name}
                          type="monotone"
                          dataKey={cat.name}
                          stroke={cat.color}
                          strokeWidth={strokeWidth}
                          strokeOpacity={strokeOpacity}
                          dot={{ r: 3, fill: cat.color }}
                          activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2, fill: cat.color }}
                        />
                      );
                    })}
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Kategori Renk Lejantı (Tıpkı Kredi Kartı Dönem Dağılımı Gibi - 2. Fotoğraf) */}
            <div className="flex flex-wrap items-center justify-center gap-1 pt-2.5 border-t border-slate-800/60 mt-1 max-h-[85px] overflow-y-auto custom-scrollbar">
              {topCategoriesForChart.map((cat) => {
                const isSelected = hoveredCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onMouseEnter={() => setHoveredCategory(cat.name)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    onClick={() => setHoveredCategory(isSelected ? null : cat.name)}
                    className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-md transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'text-white font-bold bg-slate-800/90 shadow-sm'
                        : hoveredCategory !== null
                        ? 'text-slate-500 opacity-40 hover:opacity-100 hover:text-slate-300'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                    style={
                      isSelected
                        ? {
                            boxShadow: `inset 0 0 0 1px ${cat.color}80, 0 1px 3px rgba(0,0,0,0.4)`,
                            backgroundColor: `${cat.color}18`,
                          }
                        : undefined
                    }
                    title={`${cat.name} kategorisini filtrele / vurgula`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0 transition-transform duration-150"
                      style={{
                        backgroundColor: cat.color,
                        boxShadow: isSelected ? `0 0 6px ${cat.color}` : 'none',
                        transform: isSelected ? 'scale(1.25)' : 'scale(1)',
                      }}
                    />
                    <CategoryIcon
                      name={cat.icon}
                      className="w-3 h-3 shrink-0 transition-transform duration-150"
                      style={{
                        color: cat.color,
                        transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                    <span className="truncate max-w-[140px]">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. İKİ SÜTUNLU ALT ALAN: SINKING FUND (KUMBARA) & AKILLI TESPİT MOTORU */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sol: Sinking Fund (Kumbara Hedefleri) */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Akıllı Kumbara (Sinking Fund) Hedefleri</h3>
                </div>
                <span className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
                  {sinkingFundItems.length} Şok Gider
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Gelecekteki büyük tek seferlik harcamaları (araç bakımı, kasko vb.) o gün tek seferde yüklenmek yerine kalan aylara bölerek her ay ayrılması gereken fonu belirler.
              </p>

              {sinkingFundItems.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                  Henüz tanımlı bir gelecek tek seferlik harcama yok. &quot;Yeni Plan Ekle&quot; butonundan &quot;Tek Seferlik&quot; seçerek araç bakımı veya kasko gibi bir hedef ekleyebilirsiniz.
                </div>
              ) : (
                <div className="space-y-3">
                  {sinkingFundItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 p-3.5 rounded-xl transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-amber-400 shrink-0" />
                          <div>
                            <span className="text-xs font-bold text-white">{item.plan.name}</span>
                            <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                              {item.categoryInfo.badgeLabel}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-white">
                            {isValuesHidden ? '***' : `${item.plan.amount.toLocaleString('tr-TR')} ₺`}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item.plan)}
                            className="p-1 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition cursor-pointer"
                            title="Hedefi Düzenle"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          Hedef Vade:{' '}
                          <strong className="text-slate-300">
                            {item.targetDate.toLocaleDateString('tr-TR')}
                          </strong>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 font-bold text-indigo-300">
                          {item.remainingMonths} Ay Kaldı
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-amber-400 font-semibold flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5" />
                          <span>Aylık Ayrılması Gereken:</span>
                        </span>
                        <span className="font-mono font-bold text-amber-300 text-sm">
                          {isValuesHidden ? '*** ₺' : `${Math.round(item.monthlyAllocation).toLocaleString('tr-TR')} ₺ / ay`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sağ: Akıllı Finansal Keşif & Kategori Analiz Hub'ı */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
                    <h3 className="text-sm font-bold text-white">Akıllı Finansal Keşif & Analiz</h3>
                  </div>

                  {/* Dual Mode Switcher */}
                  <div className="flex items-center bg-slate-950/80 border border-slate-800 p-0.5 rounded-xl text-[10px] font-semibold self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setDiscoveryTab('CATEGORY')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                        discoveryTab === 'CATEGORY'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Filter className="w-3 h-3" />
                      <span>Kategori Analizi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscoveryTab('AUTO')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                        discoveryTab === 'AUTO'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Otomatik Keşif ({smartSuggestions.length})</span>
                    </button>
                  </div>
                </div>

                {discoveryTab === 'CATEGORY' ? (
                  <div className="space-y-3.5">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Seçtiğiniz kategori ve alt kategorinin son ekstrelerinizdeki gerçekleşen harcamalarını analiz ederek aylık ortalama maliyeti hesaplar.
                    </p>

                    {/* Dropdowns & Range Bar */}
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Ana Kategori
                          </label>
                          <select
                            value={effectiveExplorerCategoryId}
                            onChange={(e) => {
                              setExplorerCategoryId(e.target.value ? Number(e.target.value) : '');
                              setExplorerSubCategoryId('');
                            }}
                            className="w-full h-[36px] bg-slate-950 border border-slate-800 rounded-xl px-2.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {expenseCategories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Alt Kategori
                          </label>
                          <select
                            value={explorerSubCategoryId}
                            onChange={(e) =>
                              setExplorerSubCategoryId(e.target.value ? Number(e.target.value) : '')
                            }
                            disabled={!availableExplorerSubCategories.length}
                            className="w-full h-[36px] bg-slate-950 border border-slate-800 rounded-xl px-2.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
                          >
                            <option value="">Tüm Alt Kategoriler</option>
                            {availableExplorerSubCategories.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Vade / Aralık Segmented Selector */}
                      <div className="flex items-center justify-between bg-slate-950/60 border border-slate-800/80 px-3 py-1.5 rounded-xl">
                        <span className="text-[10px] font-semibold text-slate-400">Analiz Dönemi:</span>
                        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
                          {([3, 6, 12] as const).map((range) => (
                            <button
                              key={range}
                              type="button"
                              onClick={() => setExplorerRange(range)}
                              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                                explorerRange === range
                                  ? 'bg-indigo-600 text-white shadow'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Son {range} Ay
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Analiz Sonuç Kartı */}
                    <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                            Hesaplanan Aylık Ortalama
                          </span>
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-xl font-bold font-mono text-emerald-400">
                              {isValuesHidden
                                ? '*** ₺'
                                : `${explorerStats.avgMonthly.toLocaleString('tr-TR')} ₺`}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">/ ay</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                            Dönem Toplamı ({explorerStats.txCount} İşlem)
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-300">
                            {isValuesHidden
                              ? '*** ₺'
                              : `${explorerStats.totalSpent.toLocaleString('tr-TR')} ₺`}
                          </span>
                        </div>
                      </div>

                      {/* Dönem İşlemleri Listesi */}
                      {explorerStats.recentItems.length > 0 ? (
                        <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Dönem Hareketleri ({explorerStats.txCount}):
                            </span>
                            <span className="text-[10px] text-indigo-400 font-mono font-semibold">
                              Son {explorerRange} Ay
                            </span>
                          </div>
                          <div className="space-y-1 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                            {explorerStats.recentItems.map((item, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between text-[11px] bg-slate-900/60 hover:bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-800/50 transition"
                              >
                                <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                                  <span
                                    className={`text-[9px] px-1 py-0.2 rounded font-semibold shrink-0 ${
                                      item.source === 'cc'
                                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    }`}
                                  >
                                    {item.source === 'cc' ? 'Kart' : 'Hesap'}
                                  </span>
                                  <span className="text-slate-300 truncate font-medium">{item.description}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 font-mono">
                                  <span className="text-[10px] text-slate-500">
                                    {item.date ? new Date(item.date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric', year: '2-digit' }) : ''}
                                  </span>
                                  <span className="font-bold text-slate-200">
                                    {isValuesHidden ? '***' : `${item.amount.toLocaleString('tr-TR')} ₺`}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-slate-800/80">
                          <p className="text-[11px] text-slate-500 text-center py-2.5 bg-slate-900/40 rounded-lg border border-dashed border-slate-800/60">
                            Son {explorerRange} ayda bu kategoriye ait harcama hareketi bulunamadı.
                          </p>
                        </div>
                      )}

                      {/* Ekle Butonu */}
                      <button
                        type="button"
                        onClick={handleOpenModalForExplorer}
                        disabled={explorerStats.avgMonthly <= 0}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Bu Ortalamayı Plana Ekle ({explorerStats.avgMonthly > 0 ? `${explorerStats.avgMonthly.toLocaleString('tr-TR')} ₺` : '0 ₺'})</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* AUTO TAB */
                  <div className="space-y-3.5">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Geçmiş hesap hareketleriniz ve ekstreleriniz taranarak kira, aidat ve fatura gibi düzenli yinelenen harcamalar otomatik tespit edilir.
                    </p>

                    {smartSuggestions.length === 0 ? (
                      <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                        Tebrikler! Tespit edilen tüm düzenli harcamalarınız (kira, faturalar vb.) şu anda ödeme planlarınızda kayıtlı.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[290px] overflow-y-auto custom-scrollbar pr-1">
                        {smartSuggestions.map((sugg) => (
                          <div
                            key={sugg.id}
                            className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 p-3 rounded-xl transition flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white truncate">{sugg.name}</span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold truncate">
                                  {sugg.subCategoryName ? `${sugg.categoryName} › ${sugg.subCategoryName}` : sugg.categoryName}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 truncate">
                                Son hareket: &quot;{sugg.sampleDescription}&quot;
                              </p>
                              <p className="text-xs font-mono font-bold text-emerald-400">
                                ~{isValuesHidden ? '***' : `${sugg.monthlyAmount.toLocaleString('tr-TR')} ₺ / ay`}
                              </p>
                            </div>

                            <button
                              onClick={() => handleOpenModalForSuggestion(sugg)}
                              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition shrink-0 cursor-pointer shadow-md shadow-emerald-600/20"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Plana Ekle</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 4. TÜM ÖDEME PLANLARI TABLOSU (TAB: LIST) */
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-400" />
              <span>Tüm Aktif Ödeme Planları & Taksitler ({plans.length})</span>
            </h3>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : plans.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              Henüz kayıtlı bir ödeme planı bulunmuyor.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold text-[10px] uppercase tracking-wider">
                    <th className="py-2 px-3">Plan Adı & Kategori</th>
                    <th className="py-2 px-3">Tür</th>
                    <th className="py-2 px-3">İlk Ödeme / Vade</th>
                    <th className="py-2 px-3 text-center">Süre</th>
                    <th className="py-2 px-3 text-right">Aylık Tutar</th>
                    <th className="py-2 px-3 text-right">Toplam Taahhüt</th>
                    <th className="py-2 px-3 text-center w-16">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {plans.map((p) => {
                    const catInfo = getPlanCategoryInfo(p);
                    const isOne = p.isOneTime;
                    const durationMonths = isOne ? 1 : p.installmentCount || 1;
                    const monthly = p.amount;
                    const totalCommitment = isOne ? p.amount : p.amount * durationMonths;
                    const date = new Date(p.firstInstallmentDate);
                    const cleanDescription = p.description ? p.description.replace(/\[Cat:.*?\]/, '').trim() : '';

                    return (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{p.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold leading-none shrink-0">
                              {catInfo.badgeLabel}
                            </span>
                            {cleanDescription && (
                              <span
                                className="text-[10px] text-slate-500 truncate max-w-[200px] hidden xl:inline-block"
                                title={cleanDescription}
                              >
                                • {cleanDescription}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full leading-none inline-block ${
                              p.type === PaymentPlanType.Expense
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {isOne ? 'Tek Seferlik' : 'Yinelenen / Taksitli'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-slate-300 font-mono text-xs whitespace-nowrap">
                          {date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="py-1.5 px-3 text-center font-bold text-indigo-400 text-xs whitespace-nowrap">
                          {isOne ? '1 Ay' : `${p.installmentCount} Ay`}
                        </td>
                        <td className="py-1.5 px-3 text-right font-bold text-white font-mono text-xs whitespace-nowrap">
                          {isValuesHidden
                            ? '*** ₺'
                            : isOne
                            ? `${p.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`
                            : `${monthly.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ / ay`}
                        </td>
                        <td className="py-1.5 px-3 text-right font-bold text-slate-300 font-mono text-xs whitespace-nowrap">
                          {isValuesHidden
                            ? '*** ₺'
                            : `${totalCommitment.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
                        </td>
                        <td className="py-1.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition cursor-pointer"
                              title="Planı Düzenle"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(p.id, p.name)}
                              className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition cursor-pointer"
                              title="Planı Sil"
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
          )}
        </div>
      )}

      {/* PAYMENT PLAN / MILESTONE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                {editingPlanId ? (
                  <Pencil className="w-5 h-5 text-indigo-400" />
                ) : (
                  <Target className="w-5 h-5 text-indigo-400" />
                )}
                <h2 className="text-base font-bold text-white">
                  {editingPlanId ? 'Ödeme Planını Düzenle' : 'Yeni Ödeme Planı veya Milestone Ekle'}
                </h2>
              </div>
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
                  Plan / Hedef Adı
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Örn: Ev Kirası, 60.000 Km Araç Bakımı, Kasko"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 🎯 MEVCUT KATEGORİ VE ALT KATEGORİ SEÇİMİ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Ana Kategori
                  </label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => {
                      const newCatId = e.target.value ? Number(e.target.value) : '';
                      setSelectedCategoryId(newCatId);
                      setSelectedSubCategoryId('');
                    }}
                    required
                    className="w-full h-[42px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Kategori Seçin</option>
                    {categories
                      .filter((c) =>
                        type === PaymentPlanType.Expense
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
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Alt Kategori
                  </label>
                  <select
                    value={selectedSubCategoryId}
                    onChange={(e) =>
                      setSelectedSubCategoryId(e.target.value ? Number(e.target.value) : '')
                    }
                    disabled={!availableSubCategories.length}
                    className="w-full h-[42px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
                  >
                    <option value="">
                      {availableSubCategories.length ? 'Alt Kategori Seçin (Opsiyonel)' : 'Alt Kategori Yok'}
                    </option>
                    {availableSubCategories.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TUTAR & ÖDEME TİPİ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    {isOneTime ? 'Toplam Tutar (₺)' : 'Aylık Tutar (₺)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    placeholder="25000"
                    className="w-full h-[42px] bg-slate-950 border border-slate-800 rounded-xl px-3.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    {isOneTime
                      ? 'Yalnızca ilgili vade ayında yansıtılır.'
                      : 'Her ay takvime bu tutar yansıtılır.'}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Ödeme Tipi
                  </label>
                  <label className="flex items-center justify-between w-full h-[42px] px-3.5 rounded-xl border border-slate-800 bg-slate-950 hover:border-slate-700 transition cursor-pointer select-none">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isOneTime}
                        onChange={(e) => setIsOneTime(e.target.checked)}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <span className={`text-xs font-semibold ${isOneTime ? 'text-amber-300' : 'text-slate-300'}`}>
                        Tek Seferlik (Şok / Milestone)
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                        isOneTime
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      }`}
                    >
                      {isOneTime ? 'Tek Sefer' : 'Taksitli'}
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    {isOneTime
                      ? 'Kumbara ile aylara amorti edilir.'
                      : 'Belirtilen süre boyunca her ay işlenir.'}
                  </span>
                </div>
              </div>

              {/* TARİH & TEKRAR SÜRESİ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    {isOneTime ? 'Hedef Vade Tarihi' : 'İlk Ödeme Tarihi'}
                  </label>
                  <input
                    type="date"
                    value={firstInstallmentDate}
                    onChange={(e) => setFirstInstallmentDate(e.target.value)}
                    required
                    className="w-full h-[42px] bg-slate-950 border border-slate-800 rounded-xl px-3.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    {isOneTime ? 'Harcamanın gerçekleşeceği vade.' : 'Ödemenin başlayacağı ilk ay.'}
                  </span>
                </div>

                {!isOneTime ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Tekrar Süresi (Ay)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={installmentCount}
                      onChange={(e) => setInstallmentCount(e.target.value)}
                      required
                      placeholder="6"
                      className="w-full h-[42px] bg-slate-950 border border-slate-800 rounded-xl px-3.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Girilen tarihten itibaren kaç ay eklensin? (Örn: 6).
                    </span>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Tekrar Süresi
                    </label>
                    <div className="w-full h-[42px] bg-slate-950 border border-slate-800 rounded-xl px-3.5 flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-300">1 Ay (Tek Seferlik)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        Sabit
                      </span>
                    </div>
                    <span className="text-[11px] text-amber-400/80 mt-1 block">
                      ⚡ Tek aya işlenir ve Kumbaraya amorti edilir.
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Açıklama / Not
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Detaylı notlar veya hedef gerekçesi..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingPlanId ? 'Değişiklikleri Kaydet' : 'Kaydet & Radara Ekle'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🚀 12 - 24 AYLIK NAKİT AKIŞI PROJEKSİYONU — TAM EKRAN (FULLSCREEN) OVERLAY MODALI */}
      {isHorizonFullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl p-4 sm:p-6 md:p-8 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-200">
          {/* Modal Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    12 - 24 Aylık Nakit Akışı Projeksiyonu
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    TAM EKRAN ANALİZ
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Sabit yaşam tabanı, kredi taksitleri ve şok harcamaların makro zaman projeksiyonu
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Grafik Türü Seçici */}
              <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setChartType('stacked-bar')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    chartType === 'stacked-bar'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Yığılmış Bar
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('area')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    chartType === 'area'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Alan (Area)
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('line')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    chartType === 'line'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Çizgi (Line)
                </button>
              </div>

              {/* Vade (Zoom) Seçici */}
              <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-xl text-xs font-semibold">
                <span className="text-[10px] text-slate-500 font-bold px-2 uppercase tracking-wider">Vade:</span>
                {(['3M', '6M', '1Y', '2Y'] as HorizonZoom[]).map((zoom) => (
                  <button
                    key={zoom}
                    type="button"
                    onClick={() => setHorizonZoom(zoom)}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      horizonZoom === zoom
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {zoom === '3M' ? '3 Ay' : zoom === '6M' ? '6 Ay' : zoom === '1Y' ? '1 Yıl' : '2 Yıl'}
                  </button>
                ))}
              </div>

              {/* Kapat / Küçült Butonu */}
              <button
                type="button"
                onClick={() => setIsHorizonFullscreen(false)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer shadow-md"
                title="Tam Ekrandan Çık (ESC)"
              >
                <Minimize2 className="w-4 h-4 text-indigo-400" />
                <span className="hidden sm:inline">Küçült (ESC)</span>
              </button>
            </div>
          </div>

          {/* Modal Chart Body */}
          <div className="flex-1 w-full my-4 min-h-[460px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'stacked-bar' ? (
                <BarChart data={horizonData} margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => (val >= 1000 ? `${Math.round(val / 1000)}k ₺` : `${val} ₺`)}
                  />
                  <Tooltip
                    isAnimationActive={false}
                    cursor={{ fill: 'rgba(99, 102, 241, 0.08)', radius: 8 }}
                    wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }}
                    content={renderHorizonTooltip}
                  />
                  {topCategoriesForChart.map((cat, idx) => {
                    const isSelected = hoveredCategory === cat.name;
                    const isAnySelected = hoveredCategory !== null;
                    const opacity = isSelected ? 1 : isAnySelected ? 0.18 : 1;

                    return (
                      <Bar
                        key={cat.name}
                        dataKey={cat.name}
                        stackId="categories"
                        fill={cat.color}
                        opacity={opacity}
                        isAnimationActive={false}
                        radius={idx === topCategoriesForChart.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    );
                  })}
                </BarChart>
              ) : chartType === 'area' ? (
                <AreaChart data={horizonData} margin={{ top: 25, right: 20, left: 0, bottom: 10 }}>
                  <defs>
                    {topCategoriesForChart.map((cat) => (
                      <linearGradient
                        key={`modal-grad-${cat.name}`}
                        id={`modal-grad-${cat.name.replace(/[^a-zA-Z0-9]/g, '')}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="5%" stopColor={cat.color} stopOpacity={0.85} />
                        <stop offset="95%" stopColor={cat.color} stopOpacity={0.12} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => (val >= 1000 ? `${Math.round(val / 1000)}k ₺` : `${val} ₺`)}
                  />
                  <Tooltip isAnimationActive={false} wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }} content={renderHorizonTooltip} />
                  {topCategoriesForChart.map((cat) => {
                    const isSelected = hoveredCategory === cat.name;
                    const isAnySelected = hoveredCategory !== null;
                    const opacity = isSelected ? 1 : isAnySelected ? 0.12 : 0.8;
                    const strokeOpacity = isSelected ? 1 : isAnySelected ? 0.18 : 0.9;
                    const strokeWidth = isSelected ? 3.5 : 1.5;

                    return (
                      <Area
                        key={cat.name}
                        type="monotone"
                        dataKey={cat.name}
                        stackId="1"
                        stroke={cat.color}
                        strokeWidth={strokeWidth}
                        strokeOpacity={strokeOpacity}
                        fill={`url(#modal-grad-${cat.name.replace(/[^a-zA-Z0-9]/g, '')})`}
                        fillOpacity={opacity}
                        isAnimationActive={false}
                        activeDot={
                          isSelected
                            ? { r: 7, stroke: '#ffffff', strokeWidth: 2.5, fill: cat.color }
                            : { r: 4, stroke: cat.color, strokeWidth: 1.5 }
                        }
                      />
                    );
                  })}
                </AreaChart>
              ) : (
                <LineChart data={horizonData} margin={{ top: 25, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => (val >= 1000 ? `${Math.round(val / 1000)}k ₺` : `${val} ₺`)}
                  />
                  <Tooltip isAnimationActive={false} wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }} content={renderHorizonTooltip} />
                  {topCategoriesForChart.map((cat) => {
                    const isSelected = hoveredCategory === cat.name;
                    const isAnySelected = hoveredCategory !== null;
                    const strokeOpacity = isSelected ? 1 : isAnySelected ? 0.15 : 0.9;
                    const strokeWidth = isSelected ? 3.5 : 2;

                    return (
                      <Line
                        key={cat.name}
                        type="monotone"
                        dataKey={cat.name}
                        stroke={cat.color}
                        strokeWidth={strokeWidth}
                        strokeOpacity={strokeOpacity}
                        dot={{ r: 3.5, fill: cat.color }}
                        activeDot={{ r: 7, stroke: '#ffffff', strokeWidth: 2.5, fill: cat.color }}
                      />
                    );
                  })}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Modal Footer Lejantı (Tüm Kategoriler) */}
          <div className="pt-3 border-t border-slate-800/80 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 max-h-[110px] overflow-y-auto custom-scrollbar">
                {topCategoriesForChart.map((cat) => {
                  const isSelected = hoveredCategory === cat.name;
                  return (
                    <button
                      key={`modal-${cat.name}`}
                      type="button"
                      onMouseEnter={() => setHoveredCategory(cat.name)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      onClick={() => setHoveredCategory(isSelected ? null : cat.name)}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? 'text-white font-bold bg-slate-800/90 shadow-sm'
                          : hoveredCategory !== null
                          ? 'text-slate-500 opacity-40 hover:opacity-100 hover:text-slate-300'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800/60'
                      }`}
                      style={
                        isSelected
                          ? {
                              boxShadow: `inset 0 0 0 1px ${cat.color}80, 0 1px 4px rgba(0,0,0,0.4)`,
                              backgroundColor: `${cat.color}20`,
                            }
                          : undefined
                      }
                      title={`${cat.name} kategorisini filtrele / vurgula`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0 transition-transform duration-150"
                        style={{
                          backgroundColor: cat.color,
                          boxShadow: isSelected ? `0 0 6px ${cat.color}` : 'none',
                          transform: isSelected ? 'scale(1.25)' : 'scale(1)',
                        }}
                      />
                      <CategoryIcon
                        name={cat.icon}
                        className="w-3.5 h-3.5 shrink-0 transition-transform duration-150"
                        style={{
                          color: cat.color,
                          transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                        }}
                      />
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>

              {hoveredCategory && (
                <button
                  type="button"
                  onClick={() => setHoveredCategory(null)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer shrink-0 font-medium"
                >
                  Vurguyu Temizle
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL */}
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
