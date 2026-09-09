'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-slate-900 via-slate-800/60 to-slate-900 rounded-xl ${className}`}
    />
  );
};

export const DashboardCardSkeleton = () => (
  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
    <div className="flex items-center justify-between">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
    <Skeleton className="h-8 w-36" />
    <Skeleton className="h-3 w-28" />
  </div>
);

export const ChartSkeleton = () => (
  <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <Skeleton className="h-8 w-28 rounded-xl" />
    </div>
    <Skeleton className="h-72 w-full rounded-xl" />
  </div>
);

export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-20" />
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800/40">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
    ))}
  </div>
);
