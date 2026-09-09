'use client';

import React, { useState, useEffect } from 'react';

interface LiveClockProps {
  className?: string;
}

export const LiveClock: React.FC<LiveClockProps> = ({ className = '' }) => {
  const [mounted, setMounted] = useState(false);
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      const now = new Date();
      const date = now.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const time = now.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setTimeStr(`${date} ${time}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`inline-flex items-center justify-center bg-slate-950/80 border border-slate-800/90 px-3 py-1.5 rounded-xl shadow-sm text-xs font-mono text-slate-300 tabular-nums select-none ${className}`}
      title="Canlı Sistem Tarihi ve Saati"
    >
      {mounted && timeStr ? (
        <span>{timeStr}</span>
      ) : (
        <span className="opacity-0 select-none">00.00.0000 00:00:00</span>
      )}
    </div>
  );
};

// Geriye dönük uyumluluk aliası
export const LiveIndicator = LiveClock;

