'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { Eye, EyeOff } from 'lucide-react';

interface HeaderProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  showPrivacyToggle?: boolean;
}

export function Header({ title, description, actions, showPrivacyToggle }: HeaderProps) {
  const pathname = usePathname();
  const isValuesHidden = useAuthStore((state) => state.isValuesHidden);
  const toggleValuesVisibility = useAuthStore((state) => state.toggleValuesVisibility);

  // Gizlilik Kalkanı butonu yalnızca Dashboard ekranında ('/dashboard' veya '/') gösterilir.
  // Sayfa bazında showPrivacyToggle prop'u ile override edilebilir.
  const isDashboard = pathname === '/dashboard' || pathname === '/';
  const shouldShowToggle = showPrivacyToggle !== undefined ? showPrivacyToggle : isDashboard;

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        {title && <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>}
        {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
      </div>

      {(shouldShowToggle || actions) && (
        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Privacy Mode Toggle (Kısayol: H) - Yalnızca Dashboard'da gösterilir */}
          {shouldShowToggle && (
            <button
              onClick={toggleValuesVisibility}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer border shadow-sm ${
                isValuesHidden
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 shadow-amber-500/5'
                  : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
              title="Değerleri Gizle / Göster (Klavye Kısayolu: H)"
            >
              {isValuesHidden ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>Gizlilik Kalkanı</span>
                  <kbd className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">H</kbd>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>Değerler Açık</span>
                  <kbd className="bg-slate-800 text-slate-400 text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold">H</kbd>
                </>
              )}
            </button>
          )}

          {actions}
        </div>
      )}
    </header>
  );
}

