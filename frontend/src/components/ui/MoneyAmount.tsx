'use client';

import React from 'react';
import { useAuthStore } from '@/store/auth-store';

interface MoneyAmountProps {
  amount: number;
  currency?: string;
  showSign?: boolean;
  className?: string;
  integerClassName?: string;
  fractionClassName?: string;
  currencyClassName?: string;
  decimals?: number;
  highlightProfitLoss?: boolean;
}

export const MoneyAmount: React.FC<MoneyAmountProps> = ({
  amount,
  currency = '₺',
  showSign = false,
  className = '',
  integerClassName = '',
  fractionClassName = '',
  currencyClassName = '',
  decimals = 2,
  highlightProfitLoss = false,
}) => {
  const isValuesHidden = useAuthStore((state) => state.isValuesHidden);

  if (isValuesHidden) {
    return (
      <span className={`font-mono tracking-wider opacity-60 select-none ${className}`}>
        •••••• {currency}
      </span>
    );
  }

  const isPositive = amount > 0;
  const isNegative = amount < 0;
  const sign = showSign ? (isPositive ? '+' : isNegative ? '-' : '') : isNegative ? '-' : '';
  const absAmount = Math.abs(amount || 0);

  // Format integer and fraction parts
  const formattedParts = absAmount.toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).split(',');

  const integerPart = formattedParts[0];
  const fractionPart = formattedParts[1] || '00';

  let colorClass = '';
  if (highlightProfitLoss) {
    colorClass = isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-slate-300';
  }

  return (
    <span className={`inline-flex items-baseline font-mono tabular-nums tracking-tight ${colorClass} ${className}`}>
      {sign && <span className="mr-0.5">{sign}</span>}
      <span className={`font-bold ${integerClassName}`}>{integerPart}</span>
      {decimals > 0 && (
        <span className={`text-[0.78em] opacity-75 font-medium ml-[1px] ${fractionClassName}`}>
          ,{fractionPart}
        </span>
      )}
      {currency && (
        <span className={`ml-1 text-[0.82em] opacity-80 font-semibold ${currencyClassName}`}>
          {currency}
        </span>
      )}
    </span>
  );
};
