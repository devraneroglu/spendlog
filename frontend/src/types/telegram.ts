export enum TelegramActionType {
  QueryBalance = 1,
  AddExpense = 2,
  AddIncome = 3,
  Transfer = 4,
}

export interface TelegramRule {
  id: number;
  command: string;
  pattern: string;
  actionType: TelegramActionType;
  targetAccountId?: number | null;
  targetAccountName?: string;
  targetCategoryId?: number | null;
  targetCategoryName?: string;
  responseMessageTemplate?: string;
  isEnabled: boolean;
}
