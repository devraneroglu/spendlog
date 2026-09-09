'use client';

import React, { useEffect } from 'react';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAuthStore } from '@/store/auth-store';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const toggleValuesVisibility = useAuthStore((state) => state.toggleValuesVisibility);

  // Global Keyboard Shortcut: 'H' tuşu ile tüm sayfalarda anında Gizlilik Modu Aç/Kapat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Input veya Textarea odaklıyken tetikleme
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        toggleValuesVisibility();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleValuesVisibility]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex">
        <Sidebar />
        <main className="flex-1 ml-64 p-6 lg:p-8 min-h-screen overflow-x-hidden">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}

