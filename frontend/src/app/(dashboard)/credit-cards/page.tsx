'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/axios';
import { CreditCardExpense, PeriodSummary, ParsedPdfResult, ParsedExpenseItem } from '@/types/credit-card';
import { Account, Category, AccountType } from '@/types/finance';
import { useAuthStore } from '@/store/auth-store';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import axios from 'axios';
import {
  CreditCard,
  Upload,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  ChevronRight,
  Filter,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  X,
  CreditCard as CardIcon,
  Search,
  PieChart,
  Layers,
  Sparkles,
  AlertTriangle,
  Pencil,
  Tag,
  Repeat,
  Award,
  Zap,
  ArrowRight,
  Flame,
  HelpCircle,
  TrendingUp,
  Check,
  RefreshCw,
  Info,
  Globe,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  CartesianGrid,
  LabelList,
} from 'recharts';

interface EditCategoryModalProps {
  expense: CreditCardExpense | null;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (expenseId: number, mainCatId: number | null, subCatId: number | null) => Promise<void>;
}

// 🚀 İZOLE KATEGORİ DÜZENLEME MODALI (Sıfır Gecikme & 60 FPS)
const EditCategoryModal: React.FC<EditCategoryModalProps> = React.memo(({
  expense,
  categories,
  isOpen,
  onClose,
  onSave,
}) => {
  const [mainId, setMainId] = useState<number | ''>('');
  const [subId, setSubId] = useState<number | ''>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (expense) {
      let initialMainId: number | '' = expense.categoryId || '';
      let initialSubId: number | '' = expense.subCategoryId || '';

      if (!initialMainId && expense.mainCategory && expense.mainCategory !== 'Diğer Harcamalar' && expense.mainCategory !== 'Kategorisiz') {
        const matchedMain = categories.find(
          (c) => c.name.toLowerCase() === expense.mainCategory?.toLowerCase() ||
                 c.name.toLowerCase().includes(expense.mainCategory?.toLowerCase() || '')
        );
        if (matchedMain) {
          initialMainId = matchedMain.id;
          if (!initialSubId && expense.category && matchedMain.subCategories) {
            const matchedSub = matchedMain.subCategories.find(
              (s) => s.name.toLowerCase() === expense.category?.toLowerCase() ||
                     s.name.toLowerCase().includes(expense.category?.toLowerCase() || '')
            );
            if (matchedSub) {
              initialSubId = matchedSub.id;
            }
          }
        }
      }
      setMainId(initialMainId);
      setSubId(initialSubId);
    }
  }, [expense, categories]);

  if (!isOpen || !expense) return null;

  const mainCategories = categories.filter((c) => !c.parentCategoryId);
  const selectedMain = categories.find((c) => c.id === Number(mainId));
  const availableSubCategories = selectedMain?.subCategories || [];

  const handleConfirm = async () => {
    try {
      setIsSaving(true);
      await onSave(
        expense.id,
        mainId ? Number(mainId) : null,
        subId ? Number(subId) : null
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Kategori Düzenle</h3>
              <p className="text-[11px] text-slate-400">Harcama kategorisini ve alt kategorisini güncelleyin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs space-y-1">
          <div className="flex justify-between text-slate-400">
            <span>Tarih:</span>
            <span className="font-mono text-slate-300">
              {new Date(expense.tarih).toLocaleDateString('tr-TR')}
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Açıklama:</span>
            <span className="font-semibold text-white truncate max-w-[240px]">
              {expense.description}
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Tutar:</span>
            <span className={`font-mono font-bold ${expense.isPayment ? 'text-emerald-400' : 'text-red-400'}`}>
              {expense.isPayment ? '+' : '-'}{Math.abs(expense.tutar).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Ana Kategori</label>
            <select
              value={mainId}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : '';
                setMainId(val);
                setSubId('');
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 [&>option]:bg-slate-900 [&>option]:text-white cursor-pointer"
            >
              <option value="">-- Kategorisiz / Seçin --</option>
              {mainCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Alt Kategori</label>
            <select
              value={subId}
              onChange={(e) => setSubId(e.target.value ? Number(e.target.value) : '')}
              disabled={!mainId}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40 [&>option]:bg-slate-900 [&>option]:text-white cursor-pointer"
            >
              <option value="">-- Alt Kategori Seçin --</option>
              {availableSubCategories.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition cursor-pointer"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving}
            className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 transition disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{isSaving ? 'Kaydediliyor...' : 'Kategoriyi Güncelle'}</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default function CreditCardsPage() {
  const isValuesHidden = useAuthStore((state) => state.isValuesHidden);
  const toast = useToast();
  const [expenses, setExpenses] = useState<CreditCardExpense[]>([]);
  const [periods, setPeriods] = useState<PeriodSummary[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selected Filter
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [selectedLivePeriod, setSelectedLivePeriod] = useState<string | null>(null);
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  const [livePeriods, setLivePeriods] = useState<PeriodSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchAllPeriods, setSearchAllPeriods] = useState(true); // Global Arama Modu (Tüm Dönemlerde Ara)
  const [categoryChartType, setCategoryChartType] = useState<'stacked-bar' | 'area' | 'line'>('area');
  const [isCategoryChartFullscreen, setIsCategoryChartFullscreen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [selectedSubCategoryFilter, setSelectedSubCategoryFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ANALYTICS' | 'EXPENSES' | 'CATEGORIES' | 'RECURRING'>('ANALYTICS');

  // ESC tuşu ile tam ekrandan çıkma
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCategoryChartFullscreen) {
        setIsCategoryChartFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCategoryChartFullscreen]);

  // Edit Category Modal State (Isolated Component)
  const [editingExpense, setEditingExpense] = useState<CreditCardExpense | null>(null);

  // Upload State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [targetAccountId, setTargetAccountId] = useState<number | ''>('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedPdfResult | null>(null);
  const [editableExpenses, setEditableExpenses] = useState<ParsedExpenseItem[]>([]);
  const [isSavingParsed, setIsSavingParsed] = useState(false);
  const [previewCardFilter, setPreviewCardFilter] = useState<string | null>(null);

  // Custom Confirm Modal State
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

  const fetchBaseData = async () => {
    try {
      setIsLoading(true);
      const [accRes, catRes, periodRes, livePeriodRes] = await Promise.all([
        api.get<Account[]>('/api/accounts'),
        api.get<Category[]>('/api/categories'),
        api.get<PeriodSummary[]>('/api/creditcardexpenses/periods?isLiveEntry=false'),
        api.get<PeriodSummary[]>('/api/creditcardexpenses/periods?isLiveEntry=true'),
      ]);
      setAccounts(accRes.data);
      setCategories(catRes.data);
      setPeriods(periodRes.data);
      setLivePeriods(livePeriodRes.data);

      if (periodRes.data.length > 0 && !selectedPeriod) {
        setSelectedPeriod(periodRes.data[0].periodKey);
      }
      if (livePeriodRes.data.length > 0 && !selectedLivePeriod) {
        setSelectedLivePeriod(livePeriodRes.data[0].periodKey);
      }
    } catch (err) {
      console.error('Failed to fetch credit card base data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      let url = '/api/creditcardexpenses?';
      if (showLiveOnly) {
        url += 'isLiveEntry=true&';
        if (selectedLivePeriod && selectedLivePeriod !== 'ALL' && !searchAllPeriods) {
          const [year, month] = selectedLivePeriod.split('-');
          url += `year=${year}&month=${month}&`;
        }
      } else {
        url += 'isLiveEntry=false&';
        const isGlobal = searchAllPeriods || selectedPeriod === 'ALL' || searchTerm.trim().length > 0;
        if (!isGlobal && selectedPeriod) {
          const [year, month] = selectedPeriod.split('-');
          url += `year=${year}&month=${month}&`;
        }
      }
      if (selectedAccountId) {
        url += `accountId=${selectedAccountId}&`;
      }
      if (searchTerm) {
        url += `search=${encodeURIComponent(searchTerm)}&`;
      }

      const res = await api.get<CreditCardExpense[]>(url);
      setExpenses(res.data);
    } catch (err) {
      console.error('Failed to fetch expenses', err);
    }
  };

  useEffect(() => {
    fetchBaseData();
  }, []);

  // Tüm dönemlerin kart dökümlerini tam ve eksiksiz hesaplamak için tüm harcamaları yükleyelim
  const [allExpenses, setAllExpenses] = useState<CreditCardExpense[]>([]);

  useEffect(() => {
    const fetchAllExpenses = async () => {
      try {
        const res = await api.get<CreditCardExpense[]>(`/api/creditcardexpenses?isLiveEntry=${showLiveOnly}`);
        setAllExpenses(res.data);
      } catch (err) {
        console.error('Failed to fetch all expenses for period breakdown', err);
      }
    };
    fetchAllExpenses();
  }, [periods, livePeriods, showLiveOnly]);

  useEffect(() => {
    fetchExpenses();
  }, [selectedPeriod, selectedLivePeriod, selectedAccountId, searchTerm, searchAllPeriods, showLiveOnly]);

  // Split Main Categories and Sub Categories
  const mainCategories = useMemo(() => {
    return categories.filter((c) => !c.parentCategoryId);
  }, [categories]);

  // Türkçe karakter duyarsız arama normalizasyonu (İ/i, I/ı, ğ, ü, ş, ö, ç)
  const normalizeTurkish = (text?: string | null) => {
    if (!text) return '';
    return text
      .toLocaleLowerCase('tr-TR')
      .replace(/İ/g, 'i')
      .replace(/I/g, 'ı')
      .replace(/i̇/g, 'i')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  // Format Card Number to Last 4 digits: "•••• 0915"
  const formatCardLast4 = (cardNo?: string | null) => {
    if (!cardNo) return '•••• 0915';
    const digits = cardNo.replace(/[^\d]/g, '');
    if (digits.length >= 4) {
      return `•••• ${digits.slice(-4)}`;
    }
    const clean = cardNo.split('-').pop() || cardNo;
    return `•••• ${clean.trim()}`;
  };

  // Dönem bazlı kart harcama kırılımı haritası (Asıl ve Sanal kartlar)
  const periodCardBreakdownMap = useMemo(() => {
    const map = new Map<string, { cardFormatted: string; totalExpense: number; count: number }[]>();
    
    // allExpenses'tan dönem bazlı grupla
    const periodGroupMap = new Map<string, CreditCardExpense[]>();
    for (const exp of allExpenses) {
      if (exp.isExpense) {
        const periodKey = `${exp.year}-${String(exp.month).padStart(2, '0')}`;
        const list = periodGroupMap.get(periodKey) || [];
        list.push(exp);
        periodGroupMap.set(periodKey, list);
      }
    }

    for (const [pKey, expList] of periodGroupMap.entries()) {
      const cardMap = new Map<string, { count: number; totalExpense: number }>();
      for (const e of expList) {
        const cKey = formatCardLast4(e.cardNumberMasked);
        const curr = cardMap.get(cKey) || { count: 0, totalExpense: 0 };
        curr.count += 1;
        curr.totalExpense += Math.abs(e.tutar);
        cardMap.set(cKey, curr);
      }
      const breakdowns = Array.from(cardMap.entries())
        .map(([cardFormatted, stats]) => ({
          cardFormatted,
          ...stats,
        }))
        .sort((a, b) => b.totalExpense - a.totalExpense);
      map.set(pKey, breakdowns);
    }

    return map;
  }, [allExpenses]);

  // Delete Single Expense with Custom Modal
  const handleDeleteExpense = (id: number, desc: string) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Harcamayı Sil',
      message: `"${desc}" harcamasını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      onConfirm: async () => {
        try {
          await api.delete(`/api/creditcardexpenses/${id}`);
          setExpenses((prev) => prev.filter((e) => e.id !== id));
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          fetchBaseData();
        } catch (err) {
          console.error(err);
        }
      },
    });
  };

  // Edit Category Actions (Fast Optimistic Update)
  const handleOpenEditCategory = (expense: CreditCardExpense) => {
    setEditingExpense(expense);
  };

  const handleSaveExpenseCategory = async (
    expenseId: number,
    mainCatId: number | null,
    subCatId: number | null
  ) => {
    try {
      const targetMainCat = categories.find((c) => c.id === mainCatId);
      const targetSubCat = targetMainCat?.subCategories?.find((s) => s.id === subCatId);

      const mainCatName = targetMainCat?.name || undefined;
      const subCatName = targetSubCat?.name || undefined;

      // 1. ANINDA (Optimistic) UI Güncellemesi - 0 ms bekleme!
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === expenseId
            ? {
                ...e,
                categoryId: mainCatId,
                subCategoryId: subCatId,
                categoryName: mainCatName || e.categoryName,
                mainCategory: mainCatName || e.mainCategory,
                subCategoryName: subCatName,
                category: subCatName || e.category,
              }
            : e
        )
      );

      setAllExpenses((prev) =>
        prev.map((e) =>
          e.id === expenseId
            ? {
                ...e,
                categoryId: mainCatId,
                subCategoryId: subCatId,
                categoryName: mainCatName || e.categoryName,
                mainCategory: mainCatName || e.mainCategory,
                subCategoryName: subCatName,
                category: subCatName || e.category,
              }
            : e
        )
      );

      setEditingExpense(null);

      // 2. Arka Planda Backend'e Kaydet
      await api.put(`/api/creditcardexpenses/${expenseId}/category`, {
        id: expenseId,
        categoryId: mainCatId,
        subCategoryId: subCatId,
      });

      toast.success('Harcama kategorisi başarıyla güncellendi.');
    } catch (err: any) {
      console.error('Failed to update expense category', err);
      toast.error('Kategori güncellenirken hata oluştu: ' + (err.response?.data?.detail || err.message));
      fetchExpenses();
    }
  };

  // Delete Full Period with Custom Modal
  const handleDeletePeriod = (periodKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModalState({
      isOpen: true,
      title: 'Ekstre Dönemini Sil',
      message: `${periodKey} dönemine ait TÜM ekstre harcamalarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      onConfirm: async () => {
        const [year, month] = periodKey.split('-');
        try {
          await api.delete(`/api/creditcardexpenses/period?year=${year}&month=${month}`);
          const updatedPeriods = periods.filter((p) => p.periodKey !== periodKey);
          setPeriods(updatedPeriods);
          if (selectedPeriod === periodKey) {
            setSelectedPeriod(updatedPeriods.length > 0 ? updatedPeriods[0].periodKey : null);
          }
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          fetchExpenses();
        } catch (err) {
          console.error(err);
        }
      },
    });
  };

  // Selected Period Expense Statistics
  const activePeriodData = periods.find((p) => p.periodKey === selectedPeriod);

  // Active Period Card Breakdown (A Kartı 50K, B Kartı 23K)
  const activePeriodCardBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; totalExpense: number }>();
    for (const exp of expenses) {
      if (exp.isExpense) {
        const cardKey = formatCardLast4(exp.cardNumberMasked);
        const curr = map.get(cardKey) || { count: 0, totalExpense: 0 };
        curr.count += 1;
        curr.totalExpense += Math.abs(exp.tutar);
        map.set(cardKey, curr);
      }
    }
    return Array.from(map.entries()).map(([cardFormatted, stats], idx) => ({
      cardFormatted,
      label: idx === 0 ? 'A Kartı (Asıl)' : `B Kartı (Sanal ${idx > 1 ? idx : ''})`,
      ...stats,
    }));
  }, [expenses]);

  // Active Period All Categories Breakdown (Tüm Kategoriler & Top 3)
  const activePeriodCategoryStats = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; count: number; subCategories: Map<string, number> }>();
    let totalExpenseSum = 0;

    for (const exp of expenses) {
      if (exp.isExpense) {
        const cat = exp.categoryName || exp.mainCategory || 'Diğer';
        const subCat = exp.subCategoryName || exp.category || 'Genel';
        const amt = Math.abs(exp.tutar);
        totalExpenseSum += amt;

        const curr = map.get(cat) || { name: cat, amount: 0, count: 0, subCategories: new Map<string, number>() };
        curr.amount += amt;
        curr.count += 1;
        curr.subCategories.set(subCat, (curr.subCategories.get(subCat) || 0) + amt);
        map.set(cat, curr);
      }
    }

    const allCategories = Array.from(map.values())
      .map((c) => ({
        name: c.name,
        amount: c.amount,
        count: c.count,
        percentage: totalExpenseSum > 0 ? Math.round((c.amount / totalExpenseSum) * 100) : 0,
        subCategories: Array.from(c.subCategories.entries()).map(([subName, subAmt]) => ({
          name: subName,
          amount: subAmt,
          percentage: c.amount > 0 ? Math.round((subAmt / c.amount) * 100) : 0,
        })).sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      allCategories,
      top3: allCategories.slice(0, 3),
      totalExpenseSum,
    };
  }, [expenses]);

  // 1. Filtre için Kullanılabilir Ana Kategoriler ve İşlem Sayıları
  const availableCategoriesForFilter = useMemo(() => {
    const isGlobal = searchAllPeriods || selectedPeriod === 'ALL';
    const baseList = isGlobal ? (allExpenses.length > 0 ? allExpenses : expenses) : expenses;
    const catCountMap = new Map<string, number>();

    const getMainCategoryName = (exp: CreditCardExpense): string => {
      if (exp.categoryName && exp.categoryName.trim()) {
        const catObj = categories.find((c) => c.name.toLowerCase() === exp.categoryName!.toLowerCase());
        if (catObj && catObj.parentCategoryId) {
          const parent = categories.find((p) => p.id === catObj.parentCategoryId);
          if (parent) return parent.name;
        }
        return exp.categoryName.trim();
      }
      if (exp.mainCategory && exp.mainCategory.trim()) return exp.mainCategory.trim();
      if (exp.categoryId) {
        const catObj = categories.find((c) => c.id === exp.categoryId);
        if (catObj) return catObj.name;
      }
      return 'Diğer / Kategorisiz';
    };

    for (const exp of baseList) {
      if (!exp.isExpense) continue;
      const catName = getMainCategoryName(exp);
      catCountMap.set(catName, (catCountMap.get(catName) || 0) + 1);
    }

    const parseCategoryNumber = (name: string): number => {
      const match = name.match(/^(\d+)/);
      if (match) return parseInt(match[1], 10);
      const catObj = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (catObj && typeof catObj.displayOrder === 'number') return catObj.displayOrder;
      return 999;
    };

    return Array.from(catCountMap.entries())
      .filter(([_, count]) => count > 0)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        const numA = parseCategoryNumber(a.name);
        const numB = parseCategoryNumber(b.name);
        if (numA !== numB) return numA - numB;
        return a.name.localeCompare(b.name, 'tr-TR');
      });
  }, [allExpenses, expenses, searchAllPeriods, selectedPeriod, categories]);

  // 2. Filtre için Kullanılabilir Alt Kategoriler ve İşlem Sayıları
  const availableSubCategoriesForFilter = useMemo(() => {
    const isGlobal = searchAllPeriods || selectedPeriod === 'ALL';
    const baseList = isGlobal ? (allExpenses.length > 0 ? allExpenses : expenses) : expenses;
    const subCatMap = new Map<string, number>();

    const getMainCategoryName = (exp: CreditCardExpense): string => {
      if (exp.categoryName && exp.categoryName.trim()) {
        const catObj = categories.find((c) => c.name.toLowerCase() === exp.categoryName!.toLowerCase());
        if (catObj && catObj.parentCategoryId) {
          const parent = categories.find((p) => p.id === catObj.parentCategoryId);
          if (parent) return parent.name;
        }
        return exp.categoryName.trim();
      }
      if (exp.mainCategory && exp.mainCategory.trim()) return exp.mainCategory.trim();
      if (exp.categoryId) {
        const catObj = categories.find((c) => c.id === exp.categoryId);
        if (catObj) return catObj.name;
      }
      return 'Diğer / Kategorisiz';
    };

    for (const exp of baseList) {
      if (!exp.isExpense) continue;
      const main = getMainCategoryName(exp);
      const sub = (exp.subCategoryName || exp.category || '').trim();

      if (!sub || sub === 'Kategorisiz' || sub === 'Genel') continue;

      if (selectedCategoryFilter) {
        const target = selectedCategoryFilter.trim().toLowerCase();
        const mainLower = main.toLowerCase();
        const targetNumMatch = target.match(/^(\d+)/);
        const mainNumMatch = mainLower.match(/^(\d+)/);
        const isNumMatch = targetNumMatch && mainNumMatch && targetNumMatch[1] === mainNumMatch[1];
        const isNameMatch = mainLower === target || mainLower.includes(target) || target.includes(mainLower);

        if (isNumMatch || isNameMatch) {
          subCatMap.set(sub, (subCatMap.get(sub) || 0) + 1);
        }
      } else {
        subCatMap.set(sub, (subCatMap.get(sub) || 0) + 1);
      }
    }

    return Array.from(subCatMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allExpenses, expenses, searchAllPeriods, selectedPeriod, selectedCategoryFilter, categories]);

  // 3. Filtre için Kullanılabilir Kartlar ve İşlem Sayıları
  const availableCardsForFilter = useMemo(() => {
    const isGlobal = searchAllPeriods || selectedPeriod === 'ALL';
    const baseList = isGlobal ? (allExpenses.length > 0 ? allExpenses : expenses) : expenses;
    const cardMap = new Map<string, { count: number; totalExpense: number }>();

    for (const exp of baseList) {
      if (exp.isExpense) {
        const cardKey = formatCardLast4(exp.cardNumberMasked);
        const curr = cardMap.get(cardKey) || { count: 0, totalExpense: 0 };
        curr.count += 1;
        curr.totalExpense += Math.abs(exp.tutar);
        cardMap.set(cardKey, curr);
      }
    }

    return Array.from(cardMap.entries())
      .map(([cardFormatted, stats]) => ({
        cardFormatted,
        ...stats,
      }))
      .sort((a, b) => b.totalExpense - a.totalExpense);
  }, [allExpenses, expenses, searchAllPeriods, selectedPeriod]);

  // Tekrar Eden Harcama & Akıllı Abonelik Dedektörü (Smart Recurring Advisor)
  const recurringAnalysis = useMemo(() => {
    const recurringKeywords = [
      'netflix', 'spotify', 'youtube', 'amazon prime', 'disney', 'apple.com', 'apple bill',
      'itunes', 'google storage', 'google play', 'chatgpt', 'openai', 'github', 'midjourney',
      'turkcell', 'vodafone', 'turk telekom', 'superonline', 'enerjisa', 'igdas', 'iski',
      'macfit', 'fitness', 'spor salonu', 'sigorta', 'kasko', 'hosting', 'domain', 'kira',
      'aidat', 'dsmart', 'digiturk', 'tivibu', 'bein', 'exxen', 'blutv', 'gain', 'audible',
      'patreon', 'duolingo', 'adobe'
    ];

    const detectedMap = new Map<string, {
      title: string;
      merchant: string;
      category: string;
      latestAmount: number;
      latestDate: string;
      occurrences: number;
      totalSpent: number;
      priceChanged: boolean;
      changePercentage?: number;
    }>();

    for (const exp of expenses) {
      if (!exp.isExpense) continue;
      const descLower = (exp.description || '').toLowerCase();

      // Anahtar kelime eşleşmesi
      let matchedKeyword = recurringKeywords.find((kw) => descLower.includes(kw));

      // Eğer anahtar kelime yoksa ama açıklama standart bir ödeme açıklamasıysa
      if (!matchedKeyword && (descLower.includes('abone') || descLower.includes('otomatik') || descLower.includes('duzenli'))) {
        matchedKeyword = exp.description;
      }

      if (matchedKeyword) {
        const key = matchedKeyword.toUpperCase();
        const amt = Math.abs(exp.tutar);
        const curr = detectedMap.get(key) || {
          title: exp.description || key,
          merchant: key,
          category: exp.categoryName || exp.mainCategory || 'Dijital Abonelik',
          latestAmount: amt,
          latestDate: exp.tarih ? new Date(exp.tarih).toISOString() : new Date().toISOString(),
          occurrences: 0,
          totalSpent: 0,
          priceChanged: false,
        };

        curr.occurrences += 1;
        curr.totalSpent += amt;
        if (curr.latestAmount > 0 && curr.latestAmount !== amt) {
          curr.priceChanged = true;
          curr.changePercentage = Math.round(((amt - curr.latestAmount) / curr.latestAmount) * 100);
        }
        curr.latestAmount = amt;
        detectedMap.set(key, curr);
      }
    }

    const detectedList = Array.from(detectedMap.values()).sort((a, b) => b.latestAmount - a.latestAmount);
    const monthlyTotal = detectedList.reduce((acc, curr) => acc + curr.latestAmount, 0);
    const yearlyProjection = monthlyTotal * 12;

    // Akıllı Tasarruf Tavsiyeleri
    const insights: Array<{ type: 'warning' | 'info' | 'success'; title: string; desc: string }> = [];

    if (monthlyTotal > 0) {
      insights.push({
        type: 'info',
        title: `Sabit Abonelik Yükü: ${monthlyTotal.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ / Ay`,
        desc: `Yılda yaklaşık ${yearlyProjection.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ sabit abonelik harcaması yapıyorsunuz. Kullanmadığınız servisleri iptal ederek tasarruf sağlayabilirsiniz.`,
      });
    }

    // Fiyat artışı tespiti
    const changedServices = detectedList.filter((d) => d.priceChanged);
    if (changedServices.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Abonelik Fiyat Artışı Algılandı',
        desc: `${changedServices.map((s) => s.merchant).join(', ')} aboneliğinde fiyat değişikliği tespit edildi. Paketlerinizi kontrol ediniz.`,
      });
    }

    // Birden fazla dijital platform var mı?
    const streamingServices = detectedList.filter((d) =>
      ['NETFLIX', 'SPOTIFY', 'DISNEY', 'AMAZON PRIME', 'YOUTUBE', 'EXXEN', 'BEIN'].includes(d.merchant)
    );
    if (streamingServices.length >= 3) {
      insights.push({
        type: 'warning',
        title: 'Çoklu Dijital Medya Aboneliği',
        desc: `Toplam ${streamingServices.length} farklı dijital yayın platformuna (${streamingServices.map((s) => s.merchant).join(', ')}) abonesiniz. Birlikte kullanım sıklığını gözden geçirebilirsiniz.`,
      });
    }

    // En çok harcanan ilk 3 kategori tavsiyesi
    if (activePeriodCategoryStats.top3.length > 0) {
      const top1 = activePeriodCategoryStats.top3[0];
      if (top1.percentage >= 30) {
        insights.push({
          type: 'info',
          title: `En Yüksek Harcama Kalemi: ${top1.name} (%${top1.percentage})`,
          desc: `Bu dönem borcunuzun %${top1.percentage}'i (${top1.amount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺) "${top1.name}" kategorisinde gerçekleşti.`,
        });
      }
    }

    return {
      items: detectedList,
      monthlyTotal,
      yearlyProjection,
      insights,
    };
  }, [expenses, activePeriodCategoryStats]);

  // 1. Aylık Ekstre Karşılaştırma Grafiği (Geçmiş 6-12 Dönem)
  const monthlyPeriodChartData = useMemo(() => {
    return periods
      .slice(0, 8)
      .reverse()
      .map((p) => {
        const [year, month] = p.periodKey.split('-');
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
        const monthLabel = dateObj.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' });
        return {
          periodKey: p.periodKey,
          label: monthLabel,
          totalExpense: p.totalExpense,
          transactionCount: p.expenseCount,
        };
      });
  }, [periods]);

  // 1.1. Dönemlere Göre Kategori Harcama Matrisi (Geçmiş 6-8 Dönem)
  // 1.1. Dönemlere Göre Kategori Harcama Matrisi (Geçmiş 6-8 Dönem - Tüm Ana Kategoriler)
  const { periodCategoryChartData, topCategoriesForChart } = useMemo(() => {
    if (!allExpenses.length || !periods.length) {
      return { periodCategoryChartData: [], topCategoriesForChart: [] };
    }

    // Harcamanın bağlı olduğu Ana Kategoriyi tespit et
    const getMainCategoryName = (exp: CreditCardExpense): string => {
      if (exp.categoryName && exp.categoryName.trim()) {
        const catObj = categories.find((c) => c.name.toLowerCase() === exp.categoryName!.toLowerCase());
        if (catObj && catObj.parentCategoryId) {
          const parent = categories.find((p) => p.id === catObj.parentCategoryId);
          if (parent) return parent.name;
        }
        return exp.categoryName.trim();
      }

      if (exp.mainCategory && exp.mainCategory.trim()) {
        return exp.mainCategory.trim();
      }

      if (exp.subCategoryName) {
        for (const main of categories) {
          const sub = main.subCategories?.find((s) => s.name.toLowerCase() === exp.subCategoryName!.toLowerCase());
          if (sub) return main.name;
        }
      }

      if (exp.category) {
        for (const main of categories) {
          const sub = main.subCategories?.find((s) => s.name.toLowerCase() === exp.category!.toLowerCase());
          if (sub) return main.name;
        }
        return exp.category;
      }

      return 'Diğer / Kategorisiz';
    };

    // 1. Tüm harcamaların ana kategorilerini belirleyelim ve toplamlarını hesaplayalım
    const globalCatMap = new Map<string, number>();
    for (const exp of allExpenses) {
      if (!exp.isExpense) continue;
      const mainCat = getMainCategoryName(exp);
      globalCatMap.set(mainCat, (globalCatMap.get(mainCat) || 0) + Math.abs(exp.tutar));
    }

    // 1-, 2-, 3- şeklinde numaraya göre doğal sıralama algoritması
    const parseCategoryNumber = (name: string): number => {
      const match = name.match(/^(\d+)/);
      if (match) return parseInt(match[1], 10);
      const catObj = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (catObj && typeof catObj.displayOrder === 'number') return catObj.displayOrder;
      return 999;
    };

    // Tüm ana kategorileri 1-, 2-, 3- sırasına göre sıralayalım
    const allActiveCats = Array.from(globalCatMap.entries())
      .filter(([_, total]) => total > 0)
      .map(([name]) => name)
      .sort((a, b) => {
        const numA = parseCategoryNumber(a);
        const numB = parseCategoryNumber(b);
        if (numA !== numB) return numA - numB;
        return a.localeCompare(b, 'tr-TR');
      });

    // 2. Geçmiş dönemleri kronolojik sıralayalım (Eskiden yeniye)
    const chronologicalPeriods = [...periods].slice(0, 8).reverse();

    const chartData = chronologicalPeriods.map((p) => {
      const [year, month] = p.periodKey.split('-');
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
      const monthLabel = dateObj.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' });

      const row: Record<string, any> = {
        periodKey: p.periodKey,
        label: monthLabel,
        total: 0,
      };

      for (const cat of allActiveCats) {
        row[cat] = 0;
      }

      const periodExpenses = allExpenses.filter(
        (e) => e.isExpense && e.year === parseInt(year) && e.month === parseInt(month)
      );

      for (const exp of periodExpenses) {
        const cat = getMainCategoryName(exp);
        const amt = Math.abs(exp.tutar);
        row.total += amt;
        row[cat] = (row[cat] || 0) + amt;
      }

      return row;
    });

    const modernPalette = [
      '#6366f1', // Indigo
      '#10b981', // Emerald
      '#f59e0b', // Amber
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#8b5cf6', // Purple
      '#3b82f6', // Blue
      '#f97316', // Orange
      '#14b8a6', // Teal
      '#e11d48', // Rose
      '#84cc16', // Lime
      '#a855f7', // Violet
      '#64748b', // Slate
    ];

    const categoriesWithColors = allActiveCats.map((name, idx) => {
      const matchedCat = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
      return {
        name,
        color: matchedCat?.color || modernPalette[idx % modernPalette.length],
        icon: matchedCat?.icon || 'folder',
      };
    });

    return {
      periodCategoryChartData: chartData,
      topCategoriesForChart: categoriesWithColors,
    };
  }, [allExpenses, periods, categories]);

  // Seçili Kategori için Dönemler Arası En Yüksek Harcama Değeri (Peak)
  const hoveredCategoryPeakValue = useMemo(() => {
    if (!hoveredCategory || !periodCategoryChartData.length) return 0;
    let max = 0;
    for (const row of periodCategoryChartData) {
      const val = Number(row[hoveredCategory] || 0);
      if (val > max) max = val;
    }
    return max;
  }, [hoveredCategory, periodCategoryChartData]);

  // 🏷️ Grafik Üzerinde Seçili Kategoriye Özel Dinamik Kapsül Tutar Rozeti (Pill Badge)
  const renderCustomPillLabel = (props: any, categoryColor: string) => {
    const { x, y, value } = props;
    if (x === undefined || y === undefined || value === undefined || typeof value !== 'number' || value <= 0) {
      return null;
    }

    const isPeak = value === hoveredCategoryPeakValue && hoveredCategoryPeakValue > 0;
    const formattedVal = isValuesHidden
      ? '***'
      : value >= 100000
      ? `${(value / 1000).toFixed(0)}K ₺`
      : value >= 10000
      ? `${(value / 1000).toFixed(1)}K ₺`
      : `${value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`;

    const charCount = formattedVal.length;
    const textWidth = Math.max(charCount * 6.5 + (isPeak ? 20 : 14), 48);
    const badgeHeight = 18;
    const badgeX = x - textWidth / 2;
    const badgeY = Math.max(y - badgeHeight - 6, 4);

    return (
      <g key={`pill-${x}-${y}`} className="pointer-events-none select-none">
        {/* Kapsül Arka Plan Kutusu */}
        <rect
          x={badgeX}
          y={badgeY}
          width={textWidth}
          height={badgeHeight}
          rx={6}
          ry={6}
          fill="#090d16"
          stroke={isPeak ? '#10b981' : categoryColor}
          strokeWidth={isPeak ? 1.5 : 1}
          fillOpacity={0.94}
        />
        {/* Zirve Rozeti Işıltısı */}
        {isPeak && (
          <circle
            cx={badgeX + 7}
            cy={badgeY + badgeHeight / 2}
            r={2.5}
            fill="#10b981"
          />
        )}
        {/* Tutar Metni */}
        <text
          x={isPeak ? x + 4 : x}
          y={badgeY + badgeHeight / 2 + 3.5}
          fill="#ffffff"
          fontSize={10}
          fontFamily="monospace"
          fontWeight={700}
          textAnchor="middle"
        >
          {formattedVal}
        </text>
      </g>
    );
  };

  // Kategori Grafiği için Büyükten Küçüğe Sıralı Profesyonel Tooltip (Seçili Kategori Vurgulu)
  const renderCategoryTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const validEntries = [...payload]
        .filter((p: any) => typeof p.value === 'number' && p.value > 0)
        .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));

      const periodTotal = validEntries.reduce((acc: number, curr: any) => acc + (curr.value || 0), 0);

      return (
        <div className="bg-[#090d16] border border-slate-800 rounded-2xl p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] min-w-[240px] relative z-50 select-none">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <span className="font-bold text-xs text-white">{label}</span>
            <span className="text-xs font-bold text-indigo-400 font-mono">
              {isValuesHidden ? '***' : `${periodTotal.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
            </span>
          </div>
          <div className="space-y-1">
            {validEntries.map((entry: any, index: number) => {
              const color = entry.color || entry.stroke || entry.fill || '#6366f1';
              const percent = periodTotal > 0 ? Math.round(((entry.value || 0) / periodTotal) * 100) : 0;
              const isSelected = hoveredCategory === entry.name;
              const matchedCat = topCategoriesForChart.find((c) => c.name === entry.name);

              return (
                <div
                  key={`cat-${index}`}
                  onMouseEnter={() => setHoveredCategory(entry.name)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className={`flex items-center justify-between text-xs gap-3 px-2 py-1 rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-500/25 border border-indigo-400/60 shadow-lg shadow-indigo-500/20 scale-[1.02]'
                      : 'hover:bg-slate-900/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate max-w-[155px]">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 transition-transform ${
                        isSelected ? 'ring-2 ring-white scale-125 shadow' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                    <CategoryIcon
                      name={matchedCat?.icon}
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: color }}
                    />
                    <span
                      className={`truncate text-[11px] ${
                        isSelected ? 'text-white font-bold' : 'text-slate-300'
                      }`}
                    >
                      {entry.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono">
                    <span className={`text-[10px] ${isSelected ? 'text-indigo-300 font-bold' : 'text-slate-500'}`}>
                      %{percent}
                    </span>
                    <strong className={`font-bold text-[11px] ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                      {isValuesHidden ? '***' : `${Number(entry.value).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  // 2. Günlük Kümülatif & Gün Bazlı Harcama Dağılımı
  const dailyExpenseChartData = useMemo(() => {
    const dayMap = new Map<number, number>();
    for (let d = 1; d <= 31; d++) dayMap.set(d, 0);

    let cumulative = 0;
    const sortedExpenses = [...expenses]
      .filter((e) => e.isExpense && e.tarih)
      .sort((a, b) => new Date(a.tarih).getTime() - new Date(b.tarih).getTime());

    for (const exp of sortedExpenses) {
      const d = new Date(exp.tarih).getDate();
      dayMap.set(d, (dayMap.get(d) || 0) + Math.abs(exp.tutar));
    }

    const result = [];
    for (let d = 1; d <= 31; d++) {
      const daySpent = dayMap.get(d) || 0;
      cumulative += daySpent;
      if (d <= 28 || daySpent > 0 || cumulative < activePeriodCategoryStats.totalExpenseSum) {
        result.push({
          day: `${d}`,
          gunluk: daySpent,
          kumulatif: cumulative,
        });
      }
    }
    return result;
  }, [expenses, activePeriodCategoryStats.totalExpenseSum]);

  // 3. Hafta İçi vs Hafta Sonu ve Ortalama Metrikler
  const expenseAnalyticsStats = useMemo(() => {
    let weekdaySpent = 0;
    let weekendSpent = 0;
    let maxSingleExpense = { amount: 0, description: '', date: '' };

    for (const exp of expenses) {
      if (!exp.isExpense) continue;
      const amt = Math.abs(exp.tutar);
      const dayOfWeek = exp.tarih ? new Date(exp.tarih).getDay() : 1; // 0: Pazar, 6: Cts

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendSpent += amt;
      } else {
        weekdaySpent += amt;
      }

      if (amt > maxSingleExpense.amount) {
        maxSingleExpense = {
          amount: amt,
          description: exp.description || 'Harcama',
          date: exp.tarih ? new Date(exp.tarih).toLocaleDateString('tr-TR') : '',
        };
      }
    }

    const total = weekdaySpent + weekendSpent;
    const daysInPeriod = 30;
    const dailyAvg = total > 0 ? total / daysInPeriod : 0;
    const txCount = expenses.filter((e) => e.isExpense).length;
    const avgPerTx = txCount > 0 ? total / txCount : 0;

    return {
      weekdaySpent,
      weekendSpent,
      weekdayPercent: total > 0 ? (weekdaySpent / total) * 100 : 0,
      weekendPercent: total > 0 ? (weekendSpent / total) * 100 : 0,
      maxSingleExpense,
      dailyAvg,
      avgPerTx,
    };
  }, [expenses]);

  // Helper: Ana kategori eşleşmesi (Doğal numara, isim ve hiyerarşi uyumlu)
  const matchCategory = (e: CreditCardExpense, targetCategory: string): boolean => {
    if (!targetCategory) return true;
    const targetLower = targetCategory.trim().toLowerCase();
    const mainCat = (e.categoryName || e.mainCategory || '').trim().toLowerCase();

    if (mainCat === targetLower) return true;

    // Sayısal önek eşleşmesi (Örn: "10-Giyim & Aksesuar" -> num: 10, clean: "giyim & aksesuar")
    const targetNumberMatch = targetLower.match(/^(\d+)/);
    const mainNumberMatch = mainCat.match(/^(\d+)/);

    if (targetNumberMatch) {
      const targetNum = parseInt(targetNumberMatch[1], 10);
      if (e.categoryId === targetNum) return true;
      if (mainNumberMatch && parseInt(mainNumberMatch[1], 10) === targetNum) return true;

      const cleanTarget = targetLower.replace(/^\d+[\s\-_.:]*/, '').trim();
      const cleanMain = mainCat.replace(/^\d+[\s\-_.:]*/, '').trim();
      if (cleanTarget && cleanMain && (cleanMain.includes(cleanTarget) || cleanTarget.includes(cleanMain))) {
        return true;
      }
    }

    if (mainCat && (mainCat.includes(targetLower) || targetLower.includes(mainCat))) {
      return true;
    }

    if (e.categoryId) {
      const catObj = categories.find((c) => c.id === e.categoryId);
      if (catObj) {
        const catObjName = catObj.name.toLowerCase();
        if (catObjName === targetLower || catObjName.includes(targetLower) || targetLower.includes(catObjName)) {
          return true;
        }
      }
    }

    return false;
  };

  // Helper: Alt kategori eşleşmesi
  const matchSubCategory = (e: CreditCardExpense, targetSubCategory: string): boolean => {
    if (!targetSubCategory) return true;
    const targetSubLower = targetSubCategory.trim().toLowerCase();
    const subName = (e.subCategoryName || e.category || '').trim().toLowerCase();

    if (subName === targetSubLower) return true;
    if (subName && (subName.includes(targetSubLower) || targetSubLower.includes(subName))) return true;

    if (e.subCategoryId) {
      const matchedSub = categories
        .flatMap((c) => c.subCategories || [])
        .find((s) => s.id === e.subCategoryId);
      if (matchedSub) {
        const sName = matchedSub.name.toLowerCase();
        if (sName === targetSubLower || sName.includes(targetSubLower) || targetSubLower.includes(sName)) {
          return true;
        }
      }
    }

    return false;
  };

  // Filtered Expenses by Active Card, Category Filter & Search
  const displayedExpenses = useMemo(() => {
    const isGlobal = searchAllPeriods || selectedPeriod === 'ALL' || searchTerm.trim().length > 0;
    
    // Veri Havuzu: Global modda allExpenses + expenses birleşimi
    let list: CreditCardExpense[];
    if (isGlobal) {
      if (allExpenses.length > 0) {
        const mergedMap = new Map<number, CreditCardExpense>();
        for (const e of allExpenses) mergedMap.set(e.id, e);
        for (const e of expenses) mergedMap.set(e.id, e);
        list = Array.from(mergedMap.values());
      } else {
        list = expenses;
      }
    } else {
      list = expenses;
    }

    // 1. Çok Terimli Metin Arama (Multi-Token Professional Search)
    if (searchTerm.trim().length > 0) {
      const tokens = normalizeTurkish(searchTerm.trim())
        .split(/\s+/)
        .filter((t) => t.length > 0);

      list = list.filter((e) => {
        const desc = normalizeTurkish(e.description);
        const info = normalizeTurkish(e.descriptionInfo);
        const note = normalizeTurkish(e.originalNote);
        const cat = normalizeTurkish(e.categoryName || e.mainCategory);
        const sub = normalizeTurkish(e.subCategoryName || e.category);
        const card = normalizeTurkish(e.cardNumberMasked);
        const amountStr = Math.abs(e.tutar).toString().replace('.', ',');
        const dateStr = e.tarih ? new Date(e.tarih).toLocaleDateString('tr-TR') : '';

        const searchableFields = `${desc} ${info} ${note} ${cat} ${sub} ${card} ${amountStr} ${dateStr}`;
        return tokens.every((token) => searchableFields.includes(token));
      });
    }

    // 2. Kart Filtresi
    if (activeCardFilter) {
      list = list.filter((e) => formatCardLast4(e.cardNumberMasked) === activeCardFilter);
    }

    // 3. Ana Kategori Filtresi
    if (selectedCategoryFilter) {
      list = list.filter((e) => matchCategory(e, selectedCategoryFilter));
    }

    // 4. Alt Kategori Filtresi
    if (selectedSubCategoryFilter) {
      list = list.filter((e) => matchSubCategory(e, selectedSubCategoryFilter));
    }

    return list.sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());
  }, [
    expenses,
    allExpenses,
    searchAllPeriods,
    selectedPeriod,
    searchTerm,
    activeCardFilter,
    selectedCategoryFilter,
    selectedSubCategoryFilter,
    categories,
  ]);

  // Handle PDF Upload
  const handleParsePdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setIsParsing(true);
    setPreviewCardFilter(null);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('bank_type', 'ziraat');

    try {
      const res = await axios.post<ParsedPdfResult>('http://localhost:8000/api/pdf/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      // Gelen satırları mevcut kategori ID'leri ile otomatik eşleştirerek editable state'e aktaralım
      const mapped = res.data.expenses.map((exp) => {
        let matchedMainId: number | null = null;
        let matchedSubId: number | null = null;

        // Önce alt kategorilerde ara
        if (exp.sub_category) {
          for (const main of categories) {
            const sub = main.subCategories?.find(
              (s) =>
                s.name.toLowerCase().includes(exp.sub_category!.toLowerCase()) ||
                exp.sub_category!.toLowerCase().includes(s.name.toLowerCase())
            );
            if (sub) {
              matchedMainId = main.id;
              matchedSubId = sub.id;
              break;
            }
          }
        }

        // Ana kategoride ara
        if (!matchedMainId && exp.category) {
          const main = categories.find(
            (c) =>
              c.name.toLowerCase().includes(exp.category!.toLowerCase()) ||
              exp.category!.toLowerCase().includes(c.name.toLowerCase())
          );
          if (main) {
            matchedMainId = main.id;
            if (main.subCategories && main.subCategories.length > 0) {
              matchedSubId = main.subCategories[0].id;
            }
          }
        }

        return {
          ...exp,
          categoryId: matchedMainId,
          subCategoryId: matchedSubId,
        };
      });

      setParsedResult(res.data);
      setEditableExpenses(mapped);
      toast.success(`${mapped.length} adet işlem başarıyla ayrıştırıldı.`, 'PDF Ayrıştırma Başarılı');
    } catch (err: any) {
      toast.error('PDF ayrıştırma hatası: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsParsing(false);
    }
  };

  // Preview Card Breakdown
  const previewCardBreakdown = useMemo(() => {
    if (!parsedResult) return [];
    const map = new Map<string, { count: number; totalExpense: number; totalPayment: number }>();

    for (const exp of editableExpenses) {
      const card = exp.card_number || parsedResult.card_number || 'Asıl Kart';
      const curr = map.get(card) || { count: 0, totalExpense: 0, totalPayment: 0 };
      curr.count += 1;
      if (exp.is_expense) {
        curr.totalExpense += Math.abs(exp.amount);
      } else {
        curr.totalPayment += Math.abs(exp.amount);
      }
      map.set(card, curr);
    }

    return Array.from(map.entries()).map(([cardNumber, stats], index) => {
      const isMain = index === 0 || cardNumber.includes('0915');
      const label = isMain ? 'Asıl Kart' : `Sanal / Ek Kart (${cardNumber.slice(-4)})`;
      return {
        cardNumber,
        formatted: formatCardLast4(cardNumber),
        label,
        ...stats,
      };
    });
  }, [parsedResult, editableExpenses]);

  // Filtered Preview Expenses
  const filteredPreviewExpenses = useMemo(() => {
    if (!editableExpenses.length) return [];
    if (!previewCardFilter) return editableExpenses;
    return editableExpenses.filter(
      (e) => (e.card_number || parsedResult?.card_number) === previewCardFilter
    );
  }, [editableExpenses, previewCardFilter, parsedResult]);

  // Validation: Check if any expense lacks categoryId or subCategoryId
  const unassignedCategoryCount = useMemo(() => {
    return editableExpenses.filter((e) => !e.categoryId || !e.subCategoryId).length;
  }, [editableExpenses]);

  // Handle Category Change for a Row
  const handleRowMainCategoryChange = (index: number, mainId: number) => {
    setEditableExpenses((prev) => {
      const updated = [...prev];
      const mainCat = categories.find((c) => c.id === mainId);
      const subCats = mainCat?.subCategories || [];
      const defaultSubId = subCats.length > 0 ? subCats[0].id : null;

      updated[index] = {
        ...updated[index],
        categoryId: mainId || null,
        category: mainCat?.name,
        subCategoryId: defaultSubId,
        sub_category: subCats.find((s) => s.id === defaultSubId)?.name,
      };
      return updated;
    });
  };

  // Handle SubCategory Change for a Row
  const handleRowSubCategoryChange = (index: number, subId: number) => {
    setEditableExpenses((prev) => {
      const updated = [...prev];
      const selectedMainId = updated[index].categoryId;
      const mainCat = categories.find((c) => c.id === selectedMainId);
      const subCat = mainCat?.subCategories?.find((s) => s.id === subId);
      updated[index] = {
        ...updated[index],
        subCategoryId: subId || null,
        sub_category: subCat?.name,
      };
      return updated;
    });
  };

  // Save Parsed Expenses into Backend
  const handleSaveParsedExpenses = async () => {
    if (!parsedResult || !targetAccountId) {
      toast.warning('Lütfen bir kredi kartı hesabı seçin.');
      return;
    }

    setIsSavingParsed(true);
    try {
      // 1. Ekstrenin tekil dönem yılı ve ayı belirlenir (Tüm harcamalar bu tek döneme bağlanır)
      let periodYear = new Date().getFullYear();
      let periodMonth = new Date().getMonth() + 1;

      if (parsedResult.statement_date) {
        const sParts = parsedResult.statement_date.split('.');
        if (sParts.length === 3) {
          periodYear = parseInt(sParts[2]) || periodYear;
          periodMonth = parseInt(sParts[1]) || periodMonth;
        }
      } else if (parsedResult.due_date) {
        const dParts = parsedResult.due_date.split('.');
        if (dParts.length === 3) {
          periodYear = parseInt(dParts[2]) || periodYear;
          periodMonth = parseInt(dParts[1]) || periodMonth;
        }
      }

      const expensesToSave = editableExpenses.map((e) => {
        const parts = e.date.split('.');
        const day = parseInt(parts[0]) || 1;
        const opMonth = parseInt(parts[1]) || periodMonth;
        const opYear = parseInt(parts[2]) || periodYear;

        return {
          accountId: Number(targetAccountId),
          tarih: new Date(opYear, opMonth - 1, day, 12, 0, 0).toISOString(),
          description: e.description,
          descriptionInfo: e.description_info,
          tutar: e.amount,
          cardNumberMasked: e.card_number || parsedResult.card_number || null,
          categoryId: e.categoryId ?? null,
          subCategoryId: e.subCategoryId ?? null,
          mainCategory: e.category || null,
          category: e.sub_category || null,
          year: periodYear,   // <-- EKSTRENİN TEKİL DÖNEM YILI (2026)
          month: periodMonth, // <-- EKSTRENİN TEKİL DÖNEM AYI (08)
          day: day,
          isPayment: e.is_payment,
          isExpense: e.is_expense,
          statementDate: parsedResult.statement_date
            ? new Date(parsedResult.statement_date.split('.').reverse().join('-')).toISOString()
            : null,
          dueDate: parsedResult.due_date
            ? new Date(parsedResult.due_date.split('.').reverse().join('-')).toISOString()
            : null,
          periodDebt: parsedResult.period_debt,
          minimumPayment: parsedResult.minimum_payment,
          cardLimit: parsedResult.card_limit,
          availableLimit: parsedResult.available_limit,
        };
      });

      await api.post('/api/creditcardexpenses/batch', {
        accountId: Number(targetAccountId),
        expenses: expensesToSave,
      });

      toast.success(
        `${expensesToSave.length} adet ekstre işlemi başarıyla kaydedildi.`,
        'Ekstre Onaylandı'
      );

      setIsUploadModalOpen(false);
      setParsedResult(null);
      setEditableExpenses([]);
      setUploadFile(null);
      setPreviewCardFilter(null);
      fetchBaseData();
      fetchExpenses();
    } catch (err: any) {
      console.error('Failed to save parsed expenses', err);
      toast.error('Harcamalar kaydedilirken hata oluştu: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSavingParsed(false);
    }
  };

  const creditCardAccounts = accounts.filter((a) => a.accountType === AccountType.CreditCard);

  return (
    <div>
      <Header
        title="Kredi Kartı Yönetimi & Akıllı Ekstre"
        description="Microsoft MarkItDown destekli PDF ekstre ayrıştırıcı, otomatik kategori eşleme ve dönem analizi"
        actions={
          <button
            onClick={() => {
              setTargetAccountId(creditCardAccounts[0]?.id || '');
              setParsedResult(null);
              setEditableExpenses([]);
              setUploadFile(null);
              setPreviewCardFilter(null);
              setIsUploadModalOpen(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Ekstre PDF İçe Aktar</span>
          </button>
        }
      />

      {/* Canlı Fişler Modu Aktifken Gösterilecek Bilgi Banner'ı */}
      {showLiveOnly && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900 border border-amber-500/30 rounded-2xl p-4 shadow-lg mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Bekleyen Canlı Fişler & Ön-Ekstre Havuzu</span>
                <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono">
                  {expenses.length} Fiş
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Telegram&apos;dan (<code className="text-amber-300 font-bold">/kk</code>) eklenen ve henüz resmi banka PDF ekstresi yüklenmemiş canlı harcamalarınız.
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block font-medium">Toplam Ön-Harcama:</span>
            <span className="text-xl font-bold text-amber-400 font-mono">
              {isValuesHidden ? '*** ₺' : `${Math.abs(expenses.reduce((acc, cur) => acc + cur.tutar, 0)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
            </span>
          </div>
        </div>
      )}

      {/* 🧭 SEGMENTED TAB NAVIGATION BAR (Aylık Karşılaştırma & Trendler Ana Sayfa) */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl mb-6">
        <button
          onClick={() => setActiveTab('ANALYTICS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'ANALYTICS'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/80'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>AYLIK EKSTRE KARŞILAŞTIRMASI & TRENDLER</span>
        </button>

        <button
          onClick={() => setActiveTab('EXPENSES')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'EXPENSES'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/80'
          }`}
        >
          {showLiveOnly ? <Zap className="w-4 h-4 fill-current text-amber-300" /> : <FileText className="w-4 h-4" />}
          <span>{showLiveOnly ? `⚡ CANLI FİŞLER (${displayedExpenses.length})` : `HARCAMA LİSTESİ (${displayedExpenses.length})`}</span>
        </button>

        <button
          onClick={() => setActiveTab('CATEGORIES')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'CATEGORIES'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/80'
          }`}
        >
          <PieChart className="w-4 h-4" />
          <span>KATEGORİ DAĞILIMI & ANALİZ ({activePeriodCategoryStats.allCategories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('RECURRING')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'RECURRING'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/80'
          }`}
        >
          <Repeat className="w-4 h-4" />
          <span>ABONELİK & TEKRARLAYANLAR ({recurringAnalysis.items.length})</span>
        </button>
      </div>

      {/* TAB 1 (ANA SAYFA): GRAFİKLER & AYLIK EKSTRE KARŞILAŞTIRMASI */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6">
          {/* 4 Ana Analitik KPI Kartı */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-xs text-slate-400 block mb-1">Hafta İçi Harcaması</span>
              <span className="text-lg font-bold text-indigo-400 font-mono">
                {isValuesHidden ? '***' : `${expenseAnalyticsStats.weekdaySpent.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">
                Toplamın %{expenseAnalyticsStats.weekdayPercent.toFixed(0)}&apos;i
              </span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-xs text-slate-400 block mb-1">Hafta Sonu Harcaması</span>
              <span className="text-lg font-bold text-amber-400 font-mono">
                {isValuesHidden ? '***' : `${expenseAnalyticsStats.weekendSpent.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">
                Toplamın %{expenseAnalyticsStats.weekendPercent.toFixed(0)}&apos;i
              </span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-xs text-slate-400 block mb-1">Günlük Ortalama Harcama</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {isValuesHidden ? '***' : `${expenseAnalyticsStats.dailyAvg.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ / Gün`}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">
                İşlem Başına: {expenseAnalyticsStats.avgPerTx.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
              </span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-xs text-slate-400 block mb-1">En Yüksek Tekil Harcama</span>
              <span className="text-lg font-bold text-white font-mono truncate block">
                {isValuesHidden ? '***' : `${expenseAnalyticsStats.maxSingleExpense.amount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1 truncate">
                {expenseAnalyticsStats.maxSingleExpense.description || 'Kayıt Yok'}
              </span>
            </div>
          </div>

          {/* Grafik Alanı: 2'li Analitik Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Grafik 1: Aylık Toplam Ekstre Karşılaştırması */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <BarChart className="w-4 h-4 text-indigo-400" />
                    <span>Aylık Ekstre Toplamları & Hacim</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Geçmiş ayların ekstre toplamları ve harcama hacmi trendi
                  </p>
                </div>
              </div>

              <div className="h-[270px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyPeriodChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barExpenseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}K ₺` : `${val} ₺`)}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(99, 102, 241, 0.08)', radius: 8 }}
                      contentStyle={{
                        backgroundColor: '#090d16',
                        borderColor: '#1e293b',
                        borderRadius: '12px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                        fontSize: '12px',
                      }}
                      formatter={(val: any) => [
                        isValuesHidden ? '***' : `${Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`,
                        'Ekstre Toplamı',
                      ]}
                    />
                    <Bar dataKey="totalExpense" fill="url(#barExpenseGradient)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Grafik 2: Dönemlere Göre Kategori Dağılımı & Trendi (YENİ PROFESYONEL GRAFİK) */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-emerald-400" />
                    <span>Dönemlere Göre Kategori Dağılımı</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Ekstre dönemlerinde ana harcama kategorilerinin değişimi
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Grafik Türü Seçici */}
                  <div className="flex items-center bg-slate-950/80 border border-slate-800 p-0.5 rounded-xl text-[10px] font-semibold">
                    <button
                      onClick={() => setCategoryChartType('stacked-bar')}
                      className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                        categoryChartType === 'stacked-bar'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Yığılmış Sütun Grafiği"
                    >
                      Yığılmış Bar
                    </button>
                    <button
                      onClick={() => setCategoryChartType('area')}
                      className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                        categoryChartType === 'area'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Alan Trend Grafiği"
                    >
                      Alan (Area)
                    </button>
                    <button
                      onClick={() => setCategoryChartType('line')}
                      className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                        categoryChartType === 'line'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Trend Çizgileri"
                    >
                      Çizgi (Line)
                    </button>
                  </div>

                  {/* 🚀 TAM EKRAN (FULLSCREEN) TETİKLEYİCİ BUTONU */}
                  <button
                    onClick={() => setIsCategoryChartFullscreen(true)}
                    className="p-1.5 rounded-xl bg-slate-950/80 hover:bg-indigo-600/20 border border-slate-800 hover:border-indigo-500/50 text-slate-400 hover:text-indigo-300 transition-all cursor-pointer shadow-sm group"
                    title="Grafiği Tam Ekran Genişlet (Geniş Finansal Görünüm)"
                  >
                    <Maximize2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform text-slate-400 group-hover:text-indigo-400" />
                  </button>
                </div>
              </div>

              {/* Grafik Render (Ultra Hızlı 60 FPS & Hover Focus) */}
              <div className="h-[270px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {categoryChartType === 'stacked-bar' ? (
                    <BarChart
                      data={periodCategoryChartData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}K ₺` : `${val} ₺`)}
                      />
                      <Tooltip
                        isAnimationActive={false}
                        cursor={{ fill: 'rgba(99, 102, 241, 0.08)', radius: 8 }}
                        wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }}
                        content={renderCategoryTooltip}
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
                          >
                            {isSelected && (
                              <LabelList
                                dataKey={cat.name}
                                content={(props: any) => renderCustomPillLabel(props, cat.color)}
                              />
                            )}
                          </Bar>
                        );
                      })}
                    </BarChart>
                  ) : categoryChartType === 'area' ? (
                    <AreaChart
                      data={periodCategoryChartData}
                      margin={{ top: 18, right: 10, left: -10, bottom: 0 }}
                    >
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
                      <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}K ₺` : `${val} ₺`)}
                      />
                      <Tooltip isAnimationActive={false} wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }} content={renderCategoryTooltip} />
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
                          >
                            {isSelected && (
                              <LabelList
                                dataKey={cat.name}
                                content={(props: any) => renderCustomPillLabel(props, cat.color)}
                              />
                            )}
                          </Area>
                        );
                      })}
                    </AreaChart>
                  ) : (
                    <LineChart
                      data={periodCategoryChartData}
                      margin={{ top: 18, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}K ₺` : `${val} ₺`)}
                      />
                      <Tooltip isAnimationActive={false} wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }} content={renderCategoryTooltip} />
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
                            isAnimationActive={false}
                            dot={
                              isSelected
                                ? { r: 4.5, fill: cat.color, stroke: '#ffffff', strokeWidth: 2 }
                                : { r: 2.5, fill: cat.color }
                            }
                            activeDot={{ r: 5.5, stroke: '#ffffff', strokeWidth: 2 }}
                          >
                            {isSelected && (
                              <LabelList
                                dataKey={cat.name}
                                content={(props: any) => renderCustomPillLabel(props, cat.color)}
                              />
                            )}
                          </Line>
                        );
                      })}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Kategori Renk Lejantı (Sıralı 1-, 2-, 3- & Profesyonel Rozet Tasarımı) */}
              <div className="flex flex-wrap items-center justify-center gap-1 pt-2.5 border-t border-slate-800/60 mt-1 max-h-[85px] overflow-y-auto custom-scrollbar">
                {topCategoriesForChart.map((cat) => {
                  const isSelected = hoveredCategory === cat.name;
                  return (
                    <button
                      key={cat.name}
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
          </div>

          {/* Aylık Ekstre Karşılaştırma Detaylı Tablosu (Ana Sayfa Tablosu) */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">Ekstre Dönemleri Borç, Ödeme ve Kalan Karşılaştırması</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Toplam {periods.length} Dönem
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Ekstre Dönemi</th>
                    <th className="py-3 px-4">Dönem Harcaması & Kart Dağılımı</th>
                    <th className="py-3 px-4">Borç & Ödeme Durumu</th>
                    <th className="py-3 px-4">İşlem Sayısı & Dağılımı</th>
                    <th className="py-3 px-4 text-center">İncele</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {periods.map((p) => {
                    const payRatio = p.periodDebt > 0 ? Math.min(100, Math.round((p.totalPayment / p.periodDebt) * 100)) : 0;
                    const rawBreakdowns = (p.cardBreakdowns && p.cardBreakdowns.length > 0)
                      ? p.cardBreakdowns
                      : (periodCardBreakdownMap.get(p.periodKey) || []);

                    // Tutara göre büyükten küçüğe sıralı kart dökümü
                    const cardBreakdownsExpenseSorted = [...rawBreakdowns].sort((a, b) => b.totalExpense - a.totalExpense);
                    // Adede göre büyükten küçüğe sıralı kart dökümü
                    const cardBreakdownsCountSorted = [...rawBreakdowns].sort((a, b) => b.count - a.count);

                    return (
                      <tr key={p.periodKey} className="hover:bg-slate-800/40 transition">
                        {/* 1. Sütun: Ekstre Dönemi */}
                        <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <span className="font-bold text-xs text-white block">{p.displayDate}</span>
                          </div>
                        </td>

                        {/* 2. Sütun: Dönem Harcaması & Kart Dağılımı (Alt alta dikey döküm & ortalanmış) */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-bold text-white font-mono whitespace-nowrap">
                              {isValuesHidden ? '***' : `${p.totalExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
                            </span>
                            {cardBreakdownsExpenseSorted.length > 0 && (
                              <div className="flex flex-col gap-1 min-w-[150px]">
                                {cardBreakdownsExpenseSorted.map((cb, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className="text-[10.5px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20 shadow-sm flex items-center justify-between gap-2"
                                    title={`${cb.cardFormatted}: ${cb.count} işlem`}
                                  >
                                    <span className="text-slate-400">{cb.cardFormatted}</span>
                                    <strong className="text-white font-bold">
                                      {isValuesHidden ? '***' : `${cb.totalExpense.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
                                    </strong>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 3. Sütun: Borç & Ödeme Durumu (Görsel Formatı) */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono border shadow-sm ${
                                payRatio >= 100
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  : payRatio > 0
                                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                  : 'bg-red-500/15 text-red-400 border-red-500/30'
                              }`}
                            >
                              %{payRatio}
                            </div>

                            <div className="space-y-0.5">
                              <div className="text-xs font-bold text-white font-mono">
                                {isValuesHidden ? '***' : `${p.periodDebt.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
                              </div>
                              <div className="text-[11px] font-bold text-emerald-400 font-mono">
                                {isValuesHidden
                                  ? '***'
                                  : p.totalPayment > 0
                                  ? `+${p.totalPayment.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
                                  : '0 ₺'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 4. Sütun: İşlem Sayısı & Dağılımı (Alt alta dikey döküm & ortalanmış) */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-300 font-mono whitespace-nowrap">
                              {p.expenseCount} işlem
                            </span>
                            {cardBreakdownsCountSorted.length > 0 && (
                              <div className="flex flex-col gap-1 min-w-[110px]">
                                {cardBreakdownsCountSorted.map((cb, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className="text-[10px] font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 shadow-sm flex items-center justify-between gap-2"
                                    title={`${cb.cardFormatted}`}
                                  >
                                    <span className="text-slate-400">{cb.cardFormatted}</span>
                                    <strong className="text-white">{cb.count}</strong>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 5. Sütun: İncele Butonu */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedPeriod(p.periodKey);
                              setShowLiveOnly(false);
                              setActiveTab('EXPENSES');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 transition cursor-pointer shadow-sm"
                          >
                            <span>Detay</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
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

      {/* TAB 2: HARCAMA LİSTESİ (Ledger Formatında Filtreler + Kategori Düzenleme) */}
      {activeTab === 'EXPENSES' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sol Panel: Dönem Listesi & Dönem Silme (Ödeme Tutarı ve Oranı Korunarak) */}
          <div className="lg:col-span-1 space-y-2">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-md sticky top-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  {showLiveOnly ? (
                    <>
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>Canlı Dönemler</span>
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4 text-indigo-400" />
                      <span>Ekstre Dönemleri</span>
                    </>
                  )}
                </h2>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showLiveOnly;
                      setShowLiveOnly(next);
                      setActiveCardFilter(null);
                      if (next) {
                        if (livePeriods.length > 0 && !selectedLivePeriod) {
                          setSelectedLivePeriod(livePeriods[0].periodKey);
                        }
                      } else {
                        if (periods.length > 0 && !selectedPeriod) {
                          setSelectedPeriod(periods[0].periodKey);
                        }
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
                      showLiveOnly
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30 hover:bg-amber-400'
                        : 'bg-slate-950/60 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
                    }`}
                    title={showLiveOnly ? 'Resmi ekstre dönemlerine geri dön' : 'Telegram canlı fişler ve ön-ekstre dönemlerine geç'}
                  >
                    <Zap className={`w-3.5 h-3.5 ${showLiveOnly ? 'fill-current text-slate-950' : 'text-amber-400'}`} />
                    <span>Canlı Fişler</span>
                    {livePeriods.reduce((acc, p) => acc + p.expenseCount, 0) > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        showLiveOnly ? 'bg-slate-950 text-amber-300' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {livePeriods.reduce((acc, p) => acc + p.expenseCount, 0)}
                      </span>
                    )}
                  </button>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    {showLiveOnly ? `${livePeriods.length} Canlı` : `${periods.length} Dönem`}
                  </span>
                </div>
              </div>

              {/* Sol Panel Kart Listesi (Ödeme Tutarı & Rozeti ile) */}
              <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                {/* 🌟 Tüm Dönemler (Global Seçenek) */}
                {!showLiveOnly && periods.length > 0 && (
                  <div
                    onClick={() => {
                      setSelectedPeriod('ALL');
                      setSearchAllPeriods(true);
                      setActiveCardFilter(null);
                    }}
                    className={`group w-full text-left py-2 px-2.5 rounded-xl transition flex items-center justify-between border cursor-pointer mb-2 ${
                      selectedPeriod === 'ALL' || searchAllPeriods
                        ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/30 border-indigo-500 text-white shadow-lg'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                        <Globe className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-white block">Tüm Dönemler</span>
                        <span className="text-[10px] text-slate-400">Tüm ekstre harcamaları</span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono font-bold border border-indigo-500/30">
                      {periods.reduce((acc, p) => acc + p.expenseCount, 0)}
                    </span>
                  </div>
                )}

                {showLiveOnly ? (
                  livePeriods.length > 0 ? (
                    livePeriods.map((p) => {
                      const isSelected = !searchAllPeriods && selectedLivePeriod === p.periodKey;
                      return (
                        <div
                          key={p.periodKey}
                          onClick={() => {
                            setSelectedLivePeriod(p.periodKey);
                            setSearchAllPeriods(false);
                            setActiveCardFilter(null);
                          }}
                          className={`group w-full text-left py-2 px-2.5 rounded-xl transition flex items-center justify-between border cursor-pointer ${
                            isSelected
                              ? 'bg-gradient-to-r from-amber-600/20 to-yellow-600/20 border-amber-500/50 text-white shadow'
                              : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="font-semibold text-xs text-amber-200 truncate">{p.displayDate}</span>
                            </div>
                            <span className="text-[11px] text-slate-500 block mt-0.5">{p.expenseCount} fiş</span>
                          </div>

                          <div className="px-2 flex items-center justify-center">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold font-mono border tracking-tight shadow-sm bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5" />
                              <span>Canlı</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <span className="font-bold text-xs text-amber-400 block font-mono">
                                {isValuesHidden ? '***' : `${p.totalExpense.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500 bg-slate-950/30 rounded-xl border border-slate-800/60">
                      <Zap className="w-6 h-6 text-slate-600 mx-auto mb-2 opacity-50" />
                      <span>Henüz bekleyen canlı fiş yok.</span>
                    </div>
                  )
                ) : (
                  periods.map((p) => {
                    const isSelected = !searchAllPeriods && selectedPeriod === p.periodKey;
                    const payRatio = p.periodDebt > 0 ? Math.min(100, Math.round((p.totalPayment / p.periodDebt) * 100)) : 0;
                    return (
                      <div
                        key={p.periodKey}
                        onClick={() => {
                          setSelectedPeriod(p.periodKey);
                          setSearchAllPeriods(false);
                          setActiveCardFilter(null);
                        }}
                        className={`group w-full text-left py-2 px-2.5 rounded-xl transition flex items-center justify-between border cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border-indigo-500/50 text-white shadow'
                            : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="font-semibold text-xs text-slate-200 truncate">{p.displayDate}</span>
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5">{p.expenseCount} işlem</span>
                        </div>

                        {/* Ödeme Oranı Rozeti */}
                        {p.periodDebt > 0 && (
                          <div className="px-1.5 flex items-center justify-center">
                            <span
                              className={`text-[9.5px] px-1.5 py-0.5 rounded-md font-bold font-mono border tracking-tight ${
                                p.totalPayment >= p.periodDebt
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : p.totalPayment > 0
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : 'bg-red-500/10 text-red-400 border-red-500/30'
                              }`}
                            >
                              %{payRatio}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <span className="font-bold text-xs text-white block font-mono">
                              {isValuesHidden ? '***' : `${p.totalExpense.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
                            </span>
                            {p.totalPayment > 0 && (
                              <span className="text-[10px] text-emerald-400 block font-mono font-semibold">
                                {isValuesHidden ? '***' : `+${p.totalPayment.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
                              </span>
                            )}
                          </div>

                          <button
                            title={`${p.displayDate} dönemini tamamen sil`}
                            onClick={(e) => handleDeletePeriod(p.periodKey, e)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
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

          {/* Sağ Panel: Ledger Tarzı Filtre Barı + Harcama Tablosu */}
          <div className="lg:col-span-3 space-y-4">
            {/* 🎯 LEDGER (FİNANSAL İŞLEMLER) FORMATINDA FİLTRELEME ÇUBUĞU */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-lg flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5">
              {/* Sol Grup: Arama Kutusu + Kapsam Butonu */}
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={
                      searchAllPeriods
                        ? "Tüm dönemlerde harcama veya etiket ara..."
                        : `${activePeriodData?.displayDate || 'Seçili dönemde'} ara...`
                    }
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-8 pr-8 py-1.5 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
                      title="Aramayı Temizle"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setSearchAllPeriods(!searchAllPeriods)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition border flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    searchAllPeriods
                      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50 hover:bg-indigo-600/30 shadow-sm'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                  title={
                    searchAllPeriods
                      ? "Şu an tüm ekstre dönemlerinde aranıyor (Tıklayarak seçili döneme kısıtlayın)"
                      : "Sadece seçili dönemde aranıyor (Tıklayarak tüm dönemlerde arayın)"
                  }
                >
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="whitespace-nowrap">{searchAllPeriods ? 'Tüm Aylar' : 'Tek Ay'}</span>
                </button>
              </div>

              {/* Sağ Grup: Filtre Seçiciler (Kart, Kategori, Alt Kategori, Tür, Sıfırla) */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                {/* 1. Kart Seçici */}
                <select
                  value={activeCardFilter || ''}
                  onChange={(e) => setActiveCardFilter(e.target.value || null)}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[125px] truncate"
                  title="Kart Filtresi"
                >
                  <option value="">Tüm Kartlar</option>
                  {availableCardsForFilter.map((c, idx) => (
                    <option key={idx} value={c.cardFormatted}>
                      {c.cardFormatted} ({c.count})
                    </option>
                  ))}
                </select>

                {/* 2. Ana Kategori Seçici */}
                <select
                  value={selectedCategoryFilter || ''}
                  onChange={(e) => {
                    setSelectedCategoryFilter(e.target.value || null);
                    setSelectedSubCategoryFilter(null);
                  }}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[145px] truncate"
                  title="Ana Kategori Filtresi"
                >
                  <option value="">Tüm Kategoriler</option>
                  {availableCategoriesForFilter.map((cat, idx) => (
                    <option key={idx} value={cat.name}>
                      {cat.name} ({cat.count})
                    </option>
                  ))}
                </select>

                {/* 3. Alt Kategori Seçici */}
                <select
                  value={selectedSubCategoryFilter || ''}
                  onChange={(e) => setSelectedSubCategoryFilter(e.target.value || null)}
                  className={`bg-slate-950/80 border rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[140px] truncate ${
                    selectedSubCategoryFilter ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-300' : 'border-slate-800'
                  }`}
                  title="Alt Kategori Filtresi"
                >
                  <option value="">Tüm Alt Kategoriler</option>
                  {availableSubCategoriesForFilter.map((sub, idx) => (
                    <option key={idx} value={sub.name}>
                      {sub.name} ({sub.count})
                    </option>
                  ))}
                </select>

                {/* 4. Sıfırla & Yenile Butonu */}
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setActiveCardFilter(null);
                    setSelectedCategoryFilter(null);
                    setSelectedSubCategoryFilter(null);
                    fetchExpenses();
                  }}
                  className="p-2 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                  title="Tüm Filtreleri Sıfırla & Yenile"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Harcama Tablosu */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    {searchTerm.trim().length > 0 ? (
                      <>
                        <Search className="w-3.5 h-3.5 text-indigo-400" />
                        <span>&quot;{searchTerm}&quot; Arama Sonuçları</span>
                        {searchAllPeriods && (
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-semibold">
                            Tüm Dönemler
                          </span>
                        )}
                      </>
                    ) : (searchAllPeriods || selectedPeriod === 'ALL') ? (
                      <>
                        <Globe className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Tüm Dönemlerin Harcama Dökümü</span>
                      </>
                    ) : showLiveOnly ? (
                      '⚡ Bekleyen Canlı Fişler Dökümü'
                    ) : (
                      `${activePeriodData?.displayDate || 'Seçili Dönem'} Harcama Dökümü`
                    )}
                  </span>
                  {selectedCategoryFilter && (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-semibold border border-indigo-500/30">
                      {selectedCategoryFilter} {selectedSubCategoryFilter ? `› ${selectedSubCategoryFilter}` : ''}
                    </span>
                  )}
                  {activeCardFilter && (
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono border border-slate-700">
                      {activeCardFilter}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {displayedExpenses.length > 0 && (
                    <span className="text-slate-400 font-mono text-[11px]">
                      Toplam:{' '}
                      <strong className="text-red-400">
                        {isValuesHidden
                          ? '***'
                          : `${Math.abs(
                              displayedExpenses
                                .filter((e) => e.isExpense)
                                .reduce((acc, c) => acc + c.tutar, 0)
                            ).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
                      </strong>
                    </span>
                  )}
                  <span className="text-slate-400 font-mono text-[11px] bg-slate-950/60 px-2 py-0.5 rounded-md border border-slate-800">
                    {displayedExpenses.length} işlem
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Tarih / Dönem</th>
                      <th className="py-2.5 px-3">Açıklama & Taksit</th>
                      <th className="py-2.5 px-3">Kart No</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-3 text-right">Tutar</th>
                      <th className="py-2.5 px-3 text-center w-10">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {displayedExpenses.length > 0 ? (
                      displayedExpenses.map((e) => {
                        const date = new Date(e.tarih);
                        const formattedCard = formatCardLast4(e.cardNumberMasked);
                        const isGlobalListing = searchAllPeriods || selectedPeriod === 'ALL' || searchTerm.trim().length > 0;
                        return (
                          <tr key={e.id} className="hover:bg-slate-800/40 transition group">
                            <td className="py-2 px-3 text-slate-400 font-mono whitespace-nowrap">
                              <div>{date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                              {isGlobalListing && (
                                <span className="text-[9.5px] font-mono text-indigo-300 bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20 inline-block mt-0.5">
                                  {String(e.month).padStart(2, '0')}/{e.year}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-white font-medium">{e.description}</span>
                                {e.isLiveEntry && (
                                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded-md font-bold flex items-center gap-0.5">
                                    <Zap className="w-2.5 h-2.5 text-amber-400" />
                                    <span>Canlı / Fiş</span>
                                  </span>
                                )}
                                {e.descriptionInfo && !e.isLiveEntry && (
                                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded font-semibold">
                                    {e.descriptionInfo}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className="text-[11px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                {formattedCard}
                              </span>
                            </td>
                            <td 
                              onClick={() => handleOpenEditCategory(e)}
                              className="py-2 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-800/60 rounded-lg transition"
                              title="Kategori ve alt kategoriyi değiştirmek için tıklayın"
                            >
                              {(() => {
                                const mainName = e.categoryName || e.mainCategory;
                                const subName = e.subCategoryName || e.category;
                                
                                const isUnassigned =
                                  !e.categoryId ||
                                  !e.subCategoryId ||
                                  !mainName ||
                                  mainName === 'Kategorisiz' ||
                                  mainName === 'Diğer Harcamalar' ||
                                  subName === 'Genel' ||
                                  subName === 'Kategorisiz';

                                if (isUnassigned) {
                                  const labelText = mainName && mainName !== 'Kategorisiz' 
                                    ? `${mainName} › ${subName || 'Genel'}` 
                                    : 'Kategori Seçilmedi';

                                  return (
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md hover:bg-amber-500/20 transition shadow-sm">
                                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                      <span>{labelText}</span>
                                      <Pencil className="w-3 h-3 text-amber-400/70 ml-0.5 shrink-0" />
                                    </span>
                                  );
                                }

                                return (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-200 font-medium hover:text-indigo-300 transition">
                                      {mainName}
                                    </span>
                                    {subName && subName !== 'Genel' && (
                                      <>
                                        <span className="text-slate-500 text-[10px]">›</span>
                                        <span className="text-slate-400 text-[11px]">{subName}</span>
                                      </>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                              <span className={e.isExpense ? 'text-red-400' : 'text-emerald-400'}>
                                {isValuesHidden
                                  ? '***'
                                  : `${e.isExpense ? '-' : '+'}${Math.abs(e.tutar).toLocaleString('tr-TR', {
                                      minimumFractionDigits: 2,
                                    })} ₺`}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                title="Harcamayı Sil"
                                onClick={() => handleDeleteExpense(e.id, e.description)}
                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-500 text-xs">
                          Bu kriterlere uygun harcama kaydı bulunamadı.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KATEGORİ DAĞILIMI (İNTERAKTİF DONUT GRAFİĞİ + ANALİZ BARI) */}
      {activeTab === 'CATEGORIES' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col items-center justify-center">
              <div className="w-full flex items-center justify-between mb-2">
                <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                  <PieChart className="w-4 h-4 text-amber-400" />
                  <span>Kategori Harcama Dilimleri</span>
                </h3>
                <span className="text-[10px] bg-amber-500/10 text-amber-300 font-bold px-2 py-0.5 rounded-md">
                  {activePeriodCategoryStats.allCategories.length} Kategori
                </span>
              </div>

              <div className="h-[260px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-950/95 border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs backdrop-blur-md z-50">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                <span className="font-bold text-white">{data.name}</span>
                                <span className="ml-auto font-bold text-amber-400">%{data.percentage}</span>
                              </div>
                              <div className="text-slate-200 font-mono font-bold">
                                {isValuesHidden ? '***' : `${data.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
                              </div>
                              <span className="text-[10px] text-slate-400 block mt-1">{data.count} Harcama İşlemi</span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Pie
                      data={activePeriodCategoryStats.allCategories.map((c, i) => {
                        const colors = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6', '#3b82f6', '#84cc16'];
                        return { ...c, color: colors[i % colors.length] };
                      })}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                    >
                      {activePeriodCategoryStats.allCategories.map((_, index) => {
                        const colors = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6', '#3b82f6', '#84cc16'];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Pie>
                  </RePieChart>
                </ResponsiveContainer>
                
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Toplam</span>
                  <span className="text-sm font-bold text-white font-mono">
                    {isValuesHidden ? '***' : `${activePeriodCategoryStats.totalExpenseSum.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {activePeriodCategoryStats.top3.map((cat, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
                const colors = ['from-amber-500/20 border-amber-500/40 text-amber-300', 'from-indigo-500/20 border-indigo-500/40 text-indigo-300', 'from-emerald-500/20 border-emerald-500/40 text-emerald-300'];
                return (
                  <div
                    key={idx}
                    className={`bg-gradient-to-b ${colors[idx]} to-slate-900 border rounded-2xl p-4 shadow-lg flex flex-col justify-between`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xl">{medal}</span>
                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-slate-950/60">
                          %{cat.percentage}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-white truncate">{cat.name}</h4>
                      <span className="text-[11px] text-slate-400 block mt-0.5">{cat.count} Harcama</span>
                    </div>

                    <div className="mt-4 pt-2 border-t border-slate-800/80">
                      <span className="text-xs text-slate-400 block">Tutar</span>
                      <span className="text-lg font-bold text-white font-mono">
                        {isValuesHidden ? '***' : `${cat.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-white">Tüm Kategori ve Alt Kalem Dökümü</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Herhangi bir kategoriye tıklayarak doğrudan harcama satırlarına gidebilirsiniz.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Dönem Toplam Harcaması</span>
                <span className="text-base font-bold text-white font-mono">
                  {isValuesHidden
                    ? '*** ₺'
                    : `${activePeriodCategoryStats.totalExpenseSum.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activePeriodCategoryStats.allCategories.map((cat, idx) => {
                const isSelected = selectedCategoryFilter === cat.name;
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shrink-0" />
                        <span className="font-bold text-xs text-white truncate">{cat.name}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                          {cat.count} işlem
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-xs text-white block">
                          {isValuesHidden
                            ? '***'
                            : `${cat.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
                        </span>
                        <span className="text-[11px] font-bold text-amber-400">%{cat.percentage}</span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          idx === 0
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                            : idx === 1
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-400'
                            : idx === 2
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : 'bg-indigo-500'
                        }`}
                        style={{ width: `${Math.max(4, cat.percentage)}%` }}
                      />
                    </div>

                    {cat.subCategories.length > 0 && (
                      <div className="space-y-1 pt-2 border-t border-slate-800/60 text-[11px]">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1">
                          Alt Kalemler:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {cat.subCategories.map((sub, sIdx) => (
                            <span
                              key={sIdx}
                              className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md text-slate-300 flex items-center gap-1 font-mono text-[10px]"
                            >
                              <span>{sub.name}:</span>
                              <strong className="text-white">
                                {isValuesHidden ? '***' : `${sub.amount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
                              </strong>
                              <span className="text-slate-500 font-semibold">(%{sub.percentage})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 pt-2 flex items-center justify-end">
                      <button
                        onClick={() => {
                          setSelectedCategoryFilter(cat.name);
                          setActiveTab('EXPENSES');
                        }}
                        className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Harcama Satırlarını İncele</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ABONELİK & TEKRARLAYAN HARCAMALAR */}
      {activeTab === 'RECURRING' && (
        <div className="space-y-6">
          {/* Üst Özet Kartları (3'lü KPI) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl border-l-4 border-l-indigo-500">
              <span className="text-xs text-slate-400 block mb-1">Aylık Toplam Sabit Yük</span>
              <span className="text-2xl font-bold text-white font-mono">
                {isValuesHidden
                  ? '*** ₺'
                  : `${recurringAnalysis.monthlyTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">
                Düzenli her ay ekstreye yansıyan tutar
              </span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl border-l-4 border-l-amber-500">
              <span className="text-xs text-slate-400 block mb-1">Yıllık Tahmini Projeksiyon</span>
              <span className="text-2xl font-bold text-amber-400 font-mono">
                {isValuesHidden
                  ? '*** ₺'
                  : `${recurringAnalysis.yearlyProjection.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">
                12 aylık kümülatif sabit abonelik maliyeti
              </span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl border-l-4 border-l-emerald-500">
              <span className="text-xs text-slate-400 block mb-1">Tespit Edilen Düzenli Abonelik</span>
              <span className="text-2xl font-bold text-emerald-400 font-mono">
                {recurringAnalysis.items.length} Adet
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">
                Akıllı algoritma tarafından taranan servisler
              </span>
            </div>
          </div>

          {/* Akıllı Tasarruf & Değişiklik Uyarıları */}
          {recurringAnalysis.insights.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Akıllı Tasarruf & Abonelik Analizi</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recurringAnalysis.insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border flex items-start gap-3 ${
                      insight.type === 'warning'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                        : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-slate-950/40 shrink-0">
                      {insight.type === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Info className="w-4 h-4 text-indigo-400" />
                      )}
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-white">{insight.title}</h5>
                      <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{insight.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Abonelikler ve Tekrarlayan Harcamalar Tablosu */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">Tespit Edilen Düzenli Abonelikler & Sabit Giderler</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {recurringAnalysis.items.length} Düzenli Kalem
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Servis & Açıklama</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Son İşlem Tarihi</th>
                    <th className="py-3 px-4 text-right">Aylık Tutar</th>
                    <th className="py-3 px-4 text-right">Toplam Harcanan</th>
                    <th className="py-3 px-4 text-center">Fiyat Durumu</th>
                    <th className="py-3 px-4 text-center">İncele</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {recurringAnalysis.items.length > 0 ? (
                    recurringAnalysis.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                            <Repeat className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-white block">{item.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{item.merchant}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                          <span className="bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 text-[11px]">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 font-mono whitespace-nowrap">
                          {new Date(item.latestDate).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                          {isValuesHidden
                            ? '***'
                            : `${item.latestAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                          <span className="font-bold text-slate-300">
                            {isValuesHidden
                              ? '***'
                              : `${item.totalSpent.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {item.occurrences} kez yansıdı
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {item.priceChanged ? (
                            <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                              {item.changePercentage && item.changePercentage > 0 ? `+${item.changePercentage}% Artış` : 'Fiyat Değişti'}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                              Stabil
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSearchTerm(item.merchant);
                              setActiveTab('EXPENSES');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 transition cursor-pointer shadow-sm"
                          >
                            <span>Harcamalar</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500 text-xs">
                        Düzenli tekrar eden abonelik veya sabit harcama bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PDF Upload Modal (MarkItDown Engine + Dinamik Kategori Seçimi) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full p-6 shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Akıllı Ekstre Yükleme (MarkItDown)</h2>
                  <p className="text-[11px] text-slate-400">PDF dosyanız otomatik olarak Markdown tablolara dönüştürülüp ayrıştırılır</p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!parsedResult ? (
              <form onSubmit={handleParsePdf} className="space-y-4 flex-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Hangi Kredi Kartı Hesabına Eklensin?
                  </label>
                  <select
                    value={targetAccountId}
                    onChange={(e) => setTargetAccountId(Number(e.target.value))}
                    required
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Kredi Kartı Seçin</option>
                    {creditCardAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Ekstre PDF Dosyası
                  </label>
                  <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-8 text-center transition cursor-pointer bg-slate-950/30">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="pdf-upload"
                      required
                    />
                    <label htmlFor="pdf-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-white">
                        {uploadFile ? uploadFile.name : 'PDF Ekstre dosyasını seçin veya buraya bırakın'}
                      </p>
                      <span className="text-xs text-slate-500 mt-1 block">Ziraat, Garanti, vb. banka ekstreleri</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition cursor-pointer"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={isParsing || !uploadFile}
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    <span>{isParsing ? 'MarkItDown ile Ayrıştırılıyor...' : 'PDF Ayrıştır'}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Preview Parsed Expenses with Dinamik Kategori & Alt Kategori Seçimi */
              <div className="flex-1 flex flex-col min-h-0 space-y-3">
                {/* Üst Özet Bandı (Dönem Borcu + Kart Bazlı Dağılım) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  {/* Sol: Dönem Borcu & Son Ödeme */}
                  <div className="md:col-span-5 grid grid-cols-2 gap-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Dönem Borcu</span>
                      <span className="font-bold text-red-400 text-sm font-mono">
                        {parsedResult.period_debt ? `${parsedResult.period_debt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Son Ödeme Tarihi</span>
                      <span className="font-semibold text-amber-400 text-sm">{parsedResult.due_date || '-'}</span>
                    </div>
                  </div>

                  {/* Sağ: Kart Harcama Dağılımı */}
                  <div className="md:col-span-7 flex flex-wrap items-center gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                    <div className="w-full flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                        <CardIcon className="w-3 h-3 text-indigo-400" />
                        <span>Kart Bazlı Harcama Dağılımı:</span>
                      </span>
                      <button
                        onClick={() => setPreviewCardFilter(null)}
                        className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition ${
                          previewCardFilter === null ? 'bg-indigo-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Tümü ({parsedResult.total_records})
                      </button>
                    </div>

                    {previewCardBreakdown.map((card, idx) => {
                      const isSelected = previewCardFilter === card.cardNumber;
                      return (
                        <div
                          key={idx}
                          onClick={() => setPreviewCardFilter(isSelected ? null : card.cardNumber)}
                          className={`flex-1 min-w-[170px] p-2 rounded-lg border transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                              : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-semibold text-indigo-300">
                              {card.formatted}
                            </span>
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded-full font-bold">
                              {card.count} İşlem
                            </span>
                          </div>
                          <div className="mt-1 flex items-baseline justify-between">
                            <span className="text-[10px] text-slate-400">{card.label}</span>
                            <span className="font-bold text-xs text-red-400 font-mono">
                              {card.totalExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dinamik Kategori Seçimli Önizleme Tablosu */}
                <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl max-h-[350px]">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold z-10">
                      <tr>
                        <th className="py-2.5 px-3">Tarih</th>
                        <th className="py-2.5 px-3">Açıklama & Taksit</th>
                        <th className="py-2.5 px-3">Kart No</th>
                        <th className="py-2.5 px-3">Ana Kategori</th>
                        <th className="py-2.5 px-3">Alt Kategori</th>
                        <th className="py-2.5 px-3 text-right">Tutar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {filteredPreviewExpenses.map((e, idx) => {
                        const originalIndex = editableExpenses.findIndex((item) => item === e);
                        const selectedMainId = e.categoryId || '';
                        const selectedMain = categories.find((c) => c.id === Number(selectedMainId));
                        const availableSubCategories = selectedMain?.subCategories || [];

                        const isMissingCategory = !e.categoryId || !e.subCategoryId;

                        return (
                          <tr
                            key={idx}
                            className={`transition ${
                              isMissingCategory
                                ? 'bg-amber-500/5 hover:bg-amber-500/10'
                                : 'hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="py-2 px-3 text-slate-400 font-mono whitespace-nowrap">{e.date}</td>
                            <td className="py-2 px-3 max-w-[200px]">
                              <span className="text-white font-medium block truncate">{e.description}</span>
                              {e.description_info && (
                                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded inline-block font-semibold">
                                  {e.description_info}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono text-indigo-300 text-[11px] whitespace-nowrap">
                              <span className="bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                {formatCardLast4(e.card_number || parsedResult.card_number)}
                              </span>
                            </td>

                            {/* Dinamik Ana Kategori Dropdown */}
                            <td className="py-2 px-2 min-w-[160px]">
                              <select
                                value={selectedMainId}
                                onChange={(evt) =>
                                  handleRowMainCategoryChange(originalIndex, Number(evt.target.value))
                                }
                                className={`w-full text-xs font-medium rounded-lg px-2.5 py-1.5 border transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 [&>option]:bg-slate-900 [&>option]:text-slate-100 ${
                                  !e.categoryId
                                    ? 'bg-slate-900/90 border-amber-500/60 text-amber-200 hover:border-amber-400'
                                    : 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:border-slate-600'
                                }`}
                              >
                                <option value="" className="text-slate-500 bg-slate-900">
                                  -- Kategori Seçin --
                                </option>
                                {mainCategories.map((cat) => (
                                  <option key={cat.id} value={cat.id} className="text-slate-100 bg-slate-900 py-1">
                                    {cat.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Dinamik Alt Kategori Dropdown */}
                            <td className="py-2 px-2 min-w-[160px]">
                              <select
                                value={e.subCategoryId || ''}
                                onChange={(evt) =>
                                  handleRowSubCategoryChange(originalIndex, Number(evt.target.value))
                                }
                                disabled={!e.categoryId || availableSubCategories.length === 0}
                                className={`w-full text-xs font-medium rounded-lg px-2.5 py-1.5 border transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-30 disabled:cursor-not-allowed [&>option]:bg-slate-900 [&>option]:text-slate-100 ${
                                  !e.subCategoryId
                                    ? 'bg-slate-900/90 border-amber-500/60 text-amber-200 hover:border-amber-400'
                                    : 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:border-slate-600'
                                }`}
                              >
                                <option value="" className="text-slate-500 bg-slate-900">
                                  -- Alt Kategori Seçin --
                                </option>
                                {availableSubCategories.map((sub) => (
                                  <option key={sub.id} value={sub.id} className="text-slate-100 bg-slate-900 py-1">
                                    {sub.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className={`py-2 px-3 text-right font-bold font-mono whitespace-nowrap ${e.is_payment ? 'text-emerald-400' : 'text-red-400'}`}>
                              {e.amount >= 0 ? '+' : ''}{e.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Validation Uyarı ve Onay Barı */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setParsedResult(null);
                        setEditableExpenses([]);
                        setPreviewCardFilter(null);
                      }}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800"
                    >
                      ← Başka Dosya Seç
                    </button>

                    {unassignedCategoryCount > 0 ? (
                      <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>
                          {unassignedCategoryCount} işlem kategorisiz olarak kaydedilecek
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>Tüm kategoriler eksiksiz seçildi!</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSaveParsedExpenses}
                    disabled={isSavingParsed}
                    className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSavingParsed ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>
                      {isSavingParsed
                        ? 'Kaydediliyor...'
                        : `${parsedResult.total_records} Harcamayı Sisteme Onayla`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🚀 Kategori ve Alt Kategori Düzenleme Modalı (İzole, Sıfır Gecikme) */}
      <EditCategoryModal
        expense={editingExpense}
        categories={categories}
        isOpen={Boolean(editingExpense)}
        onClose={() => setEditingExpense(null)}
        onSave={handleSaveExpenseCategory}
      />

      {/* 🚀 DÖNEMLERE GÖRE KATEGORİ DAĞILIMI — TAM EKRAN (FULLSCREEN) OVERLAY MODALI */}
      {isCategoryChartFullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl p-4 sm:p-6 md:p-8 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-200">
          {/* Modal Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <PieChart className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Dönemlere Göre Kategori Dağılımı
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    TAM EKRAN ANALİZ
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Tüm ekstre dönemlerinde ana harcama kategorilerinin dinamik değişimi ve hacim grafiği
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Grafik Türü Seçici */}
              <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setCategoryChartType('stacked-bar')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    categoryChartType === 'stacked-bar'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Yığılmış Bar
                </button>
                <button
                  onClick={() => setCategoryChartType('area')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    categoryChartType === 'area'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Alan (Area)
                </button>
                <button
                  onClick={() => setCategoryChartType('line')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    categoryChartType === 'line'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Çizgi (Line)
                </button>
              </div>

              {/* Kapat / Küçült Butonu */}
              <button
                onClick={() => setIsCategoryChartFullscreen(false)}
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
              {categoryChartType === 'stacked-bar' ? (
                <BarChart data={periodCategoryChartData} margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}K ₺` : `${val} ₺`)}
                  />
                  <Tooltip
                    isAnimationActive={false}
                    cursor={{ fill: 'rgba(99, 102, 241, 0.08)', radius: 8 }}
                    content={renderCategoryTooltip}
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
                      >
                        {isSelected && (
                          <LabelList
                            dataKey={cat.name}
                            content={(props: any) => renderCustomPillLabel(props, cat.color)}
                          />
                        )}
                      </Bar>
                    );
                  })}
                </BarChart>
              ) : categoryChartType === 'area' ? (
                <AreaChart data={periodCategoryChartData} margin={{ top: 25, right: 20, left: 0, bottom: 10 }}>
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
                  <XAxis dataKey="label" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}K ₺` : `${val} ₺`)}
                  />
                  <Tooltip isAnimationActive={false} content={renderCategoryTooltip} />
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
                      >
                        {isSelected && (
                          <LabelList
                            dataKey={cat.name}
                            content={(props: any) => renderCustomPillLabel(props, cat.color)}
                          />
                        )}
                      </Area>
                    );
                  })}
                </AreaChart>
              ) : (
                <LineChart data={periodCategoryChartData} margin={{ top: 25, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}K ₺` : `${val} ₺`)}
                  />
                  <Tooltip isAnimationActive={false} wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }} content={renderCategoryTooltip} />
                  {topCategoriesForChart.map((cat) => {
                    const isSelected = hoveredCategory === cat.name;
                    const isAnySelected = hoveredCategory !== null;
                    const strokeOpacity = isSelected ? 1 : isAnySelected ? 0.15 : 0.9;
                    const strokeWidth = isSelected ? 4 : 2;

                    return (
                      <Line
                        key={cat.name}
                        type="monotone"
                        dataKey={cat.name}
                        stroke={cat.color}
                        strokeWidth={strokeWidth}
                        strokeOpacity={strokeOpacity}
                        isAnimationActive={false}
                        dot={
                          isSelected
                            ? { r: 5, fill: cat.color, stroke: '#ffffff', strokeWidth: 2 }
                            : { r: 3, fill: cat.color }
                        }
                        activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                      >
                        {isSelected && (
                          <LabelList
                            dataKey={cat.name}
                            content={(props: any) => renderCustomPillLabel(props, cat.color)}
                          />
                        )}
                      </Line>
                    );
                  })}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Modal Footer Lejantı (Sıralı 1-, 2-, 3- & Profesyonel Tasarım) */}
          <div className="pt-3 border-t border-slate-800/80 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 max-h-[110px] overflow-y-auto custom-scrollbar">
                {topCategoriesForChart.map((cat) => {
                  const isSelected = hoveredCategory === cat.name;
                  return (
                    <button
                      key={cat.name}
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
                  onClick={() => setHoveredCategory(null)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer shrink-0 font-medium"
                >
                  Vurguyu Sıfırla
                </button>
              )}
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
