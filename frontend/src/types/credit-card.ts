export interface CreditCardExpense {
  id: number;
  accountId?: number | null;
  accountName?: string;
  categoryId?: number | null;
  categoryName?: string;
  subCategoryId?: number | null;
  subCategoryName?: string;
  tarih: string;
  description: string;
  descriptionInfo?: string;
  tutar: number;
  cardNumberMasked?: string;
  mainCategory?: string;
  category?: string;
  year: number;
  month: number;
  day: number;
  isPayment: boolean;
  isExpense: boolean;
  statementDate?: string | null;
  dueDate?: string | null;
  periodDebt?: number | null;
  minimumPayment?: number | null;
  cardLimit?: number | null;
  availableLimit?: number | null;
  isLiveEntry?: boolean;
  originalNote?: string | null;
  receiptImageUrl?: string | null;
}

export interface PeriodCardBreakdown {
  cardFormatted: string;
  totalExpense: number;
  count: number;
}

export interface PeriodSummary {
  periodKey: string;
  displayDate: string;
  periodDebt: number;
  totalPayment: number;
  totalExpense: number;
  expenseCount: number;
  statementDate?: string | null;
  dueDate?: string | null;
  isLive?: boolean;
  cardBreakdowns?: PeriodCardBreakdown[];
}

export interface ParsedExpenseItem {
  date: string;
  year?: number;
  month?: number;
  day?: number;
  description: string;
  description_info?: string | null;
  amount: number;
  card_number?: string;
  category?: string;
  sub_category?: string;
  categoryId?: number | null;
  subCategoryId?: number | null;
  is_payment: boolean;
  is_expense: boolean;
}

export interface ParsedPdfResult {
  success: boolean;
  total_records: number;
  statement_date?: string | null;
  due_date?: string | null;
  period_debt?: number | null;
  minimum_payment?: number | null;
  card_limit?: number | null;
  available_limit?: number | null;
  card_number?: string;
  expenses: ParsedExpenseItem[];
}
