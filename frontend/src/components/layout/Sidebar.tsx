'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { api } from '@/lib/axios';
import {
  LayoutDashboard,
  Wallet,
  FolderTree,
  ArrowUpDown,
  ArrowRightLeft,
  CreditCard,
  TrendingUp,
  LineChart,
  Layers,
  CalendarDays,
  Fuel,
  Bot,
  Cpu,
  LogOut,
  Bell,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: {
    text: string;
    type: 'live' | 'pro';
  };
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'GENEL BAKIŞ',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'NAKİT & BANKACILIK',
    items: [
      { label: 'Hesaplar', href: '/accounts', icon: Wallet },
      { label: 'İşlemler', href: '/transactions', icon: ArrowUpDown },
      { label: 'Transferler', href: '/transfers', icon: ArrowRightLeft },
      { label: 'Kredi Kartı', href: '/credit-cards', icon: CreditCard },
      { label: 'Kategoriler', href: '/categories', icon: FolderTree },
    ],
  },
  {
    title: 'YATIRIM & PİYASALAR',
    items: [
      {
        label: 'Piyasalar',
        href: '/markets',
        icon: TrendingUp,
        badge: { text: 'CANLI', type: 'live' },
      },
      { label: 'Portföyüm', href: '/portfolio', icon: LineChart },
      { label: 'Strateji & Sepet', href: '/strategy-baskets', icon: Layers },
      { label: 'Fiyat Alarmları', href: '/price-alerts', icon: Bell },
    ],
  },
  {
    title: 'OPERASYON & SİSTEM',
    items: [
      { label: 'Ödeme & Nakit Projeksiyonu', href: '/payment-planner', icon: CalendarDays },
      { label: 'Yakıt & Araç Takibi', href: '/fuel-tracker', icon: Fuel },
      { label: 'Telegram Kuralları', href: '/telegram-rules', icon: Bot },
      { label: 'Veri Zamanlayıcı', href: '/scheduler', icon: Cpu },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.isAdmin || user?.roles?.includes('Admin') || user?.email?.toLowerCase() === 'admin@spendlog.com';

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Session temizliğini engellemez
    }
    logout();
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-slate-900/95 backdrop-blur-md border-r border-slate-800/80 flex flex-col h-screen fixed left-0 top-0 z-30 shadow-2xl">
      {/* Brand Logo Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white tracking-tight text-lg">SpendLog</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold px-1.5 py-0.5 rounded-md">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Enterprise Wealth</p>
          </div>
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
        {NAV_SECTIONS.map((section, sIdx) => {
          const visibleItems = section.items.filter((item) => {
            if (item.href === '/scheduler' && !isAdmin) return false;
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-0.5">
              <div className="px-3 pt-1 pb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {section.title}
              </div>

              {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-slate-800/90 text-white font-semibold border-l-2 border-indigo-400 shadow-sm shadow-indigo-950/50'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 tracking-tight shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {item.badge.text}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>

      {/* User Info Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        {/* User Card */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-800 to-indigo-950 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300 text-xs shrink-0 shadow-inner">
              {user?.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'SL'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {user?.fullName || 'SpendLog Admin'}
              </p>
              <p className="text-[10px] text-slate-500 truncate leading-tight">
                {user?.email || 'admin@spendlog.com'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Güvenli Çıkış Yap"
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
