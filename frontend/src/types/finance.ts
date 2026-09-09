export enum AccountType {
  Cash = 1,
  Bank = 2,
  CreditCard = 3,
  Investment = 4,
  Crypto = 5,
  Other = 6,
}

export enum TransactionType {
  Income = 1,
  Expense = 2,
}

export enum CategoryType {
  Expense = 1,
  Income = 2,
  Both = 3,
}

export enum AssetType {
  Stock = 1,
  Crypto = 2,
  Commodity = 3,
  ETF = 4,
  Bond = 5,
}

export enum Currency {
  TRY = 1,
  USD = 2,
  EUR = 3,
  GBP = 4,
  BTC = 5,
  ETH = 6,
}

export interface Account {
  id: number;
  name: string;
  accountType: AccountType;
  currency: Currency;
  initialBalance: number;
  currentBalance: number;
  color?: string;
  icon?: string;
  iban?: string;
  cardNumberMasked?: string;
  isActive: boolean;
  description?: string;
}

export interface Category {
  id: number;
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
  displayOrder: number;
  parentCategoryId?: number | null;
  subCategories: Category[];
}

export interface Transaction {
  id: number;
  accountId: number;
  accountName: string;
  categoryId?: number | null;
  categoryName?: string;
  subCategoryId?: number | null;
  subCategoryName?: string;
  amount: number;
  type: TransactionType;
  transactionDate: string;
  description?: string;
  tags?: string;
  isTransfer?: boolean;
  transferId?: number | null;
  transferTargetAccountName?: string | null;
}

export interface Transfer {
  id: number;
  fromAccountId: number;
  fromAccountName: string;
  toAccountId: number;
  toAccountName: string;
  amount: number;
  fee?: number;
  transferDate: string;
  description?: string;
}
