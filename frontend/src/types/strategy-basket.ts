import { AssetType, Currency } from './finance';

export interface StrategyBasketItem {
  id: number;
  strategyBasketId: number;
  symbol: string;
  name: string;
  assetType: AssetType;
  currency: Currency;
  quantity: number;
  currentPrice: number;
  targetPrice: number;
  targetProfitPercent: number;
  platform?: string;
  notes?: string;
  requiredCapital: number;
  targetValue: number;
  targetProfitLoss: number;
  calculatedProfitPercent: number;
}

export interface StrategyBasket {
  id: number;
  name: string;
  description?: string;
  targetDate?: string;
  isArchived: boolean;
  createdAt: string;
  items: StrategyBasketItem[];
  totalRequiredCapitalTRY: number;
  totalTargetValueTRY: number;
  totalTargetProfitLossTRY: number;
  totalTargetProfitPercentTRY: number;
  totalRequiredCapitalUSD: number;
  totalTargetValueUSD: number;
  totalTargetProfitLossUSD: number;
}
