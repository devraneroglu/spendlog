export enum PaymentPlanType {
  Expense = 1,
  Income = 2,
}

export enum PlanCategory {
  Rent = 'Kira & Konut',
  Bill = 'Fatura & Abonelik',
  Installment = 'Kredi & Taksit',
  Vehicle = 'Araç & Ulaşım (Bakım/Sigorta)',
  Milestone = 'Özel Hedef & Milestone',
  Other = 'Diğer',
}

export interface PaymentPlan {
  id: number;
  name: string;
  amount: number;
  firstInstallmentDate: string;
  installmentCount: number;
  isOneTime: boolean;
  type: PaymentPlanType;
  isIncome: boolean;
  description?: string;
  category?: string;
  categoryId?: number | null;
  categoryName?: string;
  subCategoryId?: number | null;
  subCategoryName?: string;
}

export interface SmartRecurringSuggestion {
  id: string;
  name: string;
  category: PlanCategory;
  categoryId?: number | null;
  categoryName?: string;
  subCategoryId?: number | null;
  subCategoryName?: string;
  monthlyAmount: number;
  lastOccurrenceDate: string;
  sampleDescription: string;
  source: 'transaction' | 'creditcard';
}

export interface HorizonMonthData {
  monthKey: string;
  monthLabel: string;
  baseAmount: number;
  installmentAmount: number;
  milestoneAmount: number;
  totalAmount: number;
  items: Array<{ name: string; amount: number; type: 'base' | 'installment' | 'milestone' }>;
}
