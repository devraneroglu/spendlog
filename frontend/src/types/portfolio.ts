import { AssetType, Currency } from './finance';

export interface PortfolioItem {
  id: number;
  symbol: string;
  name: string;
  assetType: AssetType;
  currency: Currency;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;
  platform?: string;
  notes?: string;
  isActive: boolean;
  targetPrice?: number | null;
  salePrice?: number | null;
  saleDate?: string | null;
  cost: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercent: number;
}

export interface PortfolioSummary {
  totalCostTRY: number;
  totalCurrentValueTRY: number;
  totalProfitLossTRY: number;
  totalProfitLossPercent: number;
  totalCostUSD: number;
  totalCurrentValueUSD: number;
  totalProfitLossUSD: number;
  totalRealizedProfitLossTRY: number;
  usdToTryRate: number;
  activeItemsCount: number;
  soldItemsCount: number;
}

export interface DistributionItem {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

export interface PortfolioDistribution {
  byAssetType: DistributionItem[];
  byPlatform: DistributionItem[];
  totalValue: number;
}

export interface PortfolioSnapshot {
  id: number;
  snapshotDate: string;
  totalValueTRY: number;
  totalValueUSD: number;
  stockValueTRY: number;
  cryptoValueTRY: number;
  commodityValueTRY: number;
  etfValueTRY: number;
  bondValueTRY: number;
  exchangeRate: number;
}

export enum PriceAlertCondition {
  AboveOrEqual = 1,
  BelowOrEqual = 2,
}

export interface PriceAlert {
  id: number;
  symbol: string;
  name: string;
  assetType: AssetType;
  currency: Currency;
  targetPrice: number;
  condition: PriceAlertCondition;
  note?: string | null;
  isActive: boolean;
  isTriggered: boolean;
  triggeredAt?: string | null;
  triggeredPrice?: number | null;
  isRecurring: boolean;
  createdAt: string;
}

