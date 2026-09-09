'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { api } from '@/lib/axios';
import { AuthResponse } from '@/types/auth';
import {
  Wallet,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Eye,
  EyeOff,
  ShieldCheck,
  TrendingUp,
  PieChart,
  CreditCard,
  Activity,
  Send,
  Fuel,
  Landmark,
} from 'lucide-react';

const showcaseFeatures = [
  {
    title: 'Canlı Finans Piyasaları',
    description: 'BIST 100, kripto varlıklar, serbest piyasa döviz ve altın anlık takibi.',
    icon: TrendingUp,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    title: 'Portföy Sepeti & Strateji',
    description: 'Dinamik kâr/zarar, hedef varlık dağılımı ve portföy dengeleme.',
    icon: PieChart,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
  },
  {
    title: 'Kredi Kartı & Akıllı Ekstre',
    description: 'Otomatik ekstre ayrıştırma, taksit simülasyonu ve harcama filtreleme.',
    icon: CreditCard,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
  {
    title: '12-24 Aylık Nakit Akışı Projeksiyonu',
    description: 'Gelecek 24 ayın nakit dengesi, taban yaşam maliyeti ve nakit darboğazı tahmini.',
    icon: Activity,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
  },
  {
    title: 'Telegram Finansal Asistanı',
    description: 'Anlık bütçe bildirimleri, yaklaşan ödeme alarmları ve limit uyarıları.',
    icon: Send,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  {
    title: 'Akaryakıt & Tüketim Radarı',
    description: 'Fişten otomatik kilometre tespiti, tüketim maliyeti ve araç masrafları.',
    icon: Fuel,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    title: 'Konsolide Varlık Analitiği',
    description: 'Tüm banka ve yatırım hesaplarının tek merkezden net büyüme trendi.',
    icon: Landmark,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Eğer kullanıcı zaten giriş yapmışsa doğrudan Dashboard'a yönlendir
  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [hasHydrated, isAuthenticated, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<AuthResponse>('/api/auth/login', {
        email,
        password,
      });

      if (response.data.success && response.data.accessToken && response.data.refreshToken && response.data.user) {
        setAuth(response.data.user, response.data.accessToken, response.data.refreshToken);
        router.push('/dashboard');
      } else {
        setError(response.data.message || 'Giriş yapılamadı.');
      }
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError('Çok fazla oturum denemesi yapıldı. Güvenliğiniz için lütfen 1 dakika bekleyip tekrar deneyin.');
      } else {
        setError(err.response?.data?.message || err.response?.data?.detail || 'Sunucuya bağlanırken bir hata oluştu.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Sonsuz kesintisiz akış için listeyi iki kez kopyalıyoruz
  const duplicatedFeatures = [...showcaseFeatures, ...showcaseFeatures];

  const isLockoutError = error?.includes('kilitlenmiştir');
  const isWarningError = error?.includes('Kalan deneme hakkı');
  const isRateLimitError = error?.includes('bekleyip') || error?.includes('Sınırı');

  return (
    <div className="min-h-screen flex flex-col justify-between items-center relative overflow-hidden bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Arka Plan Ambient Işımaları */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/3 w-[450px] h-[450px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Üst / Orta: Merkezlenmiş Giriş Kartı */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md px-4 sm:px-6 my-auto relative z-10 space-y-6 pt-10 pb-6">
        {/* SpendLog Logo ve Marka */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-500 flex items-center justify-center shadow-xl shadow-indigo-500/25 transition-transform hover:scale-105 duration-200">
            <Wallet className="w-7 h-7 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white tracking-tight text-2xl">SpendLog</span>
            <span className="text-[11px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold px-2 py-0.5 rounded-lg shadow-sm">
              PRO v2.0
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">Kurumsal Finans & Varlık Yönetimi</p>
        </div>

        {/* Giriş Kartı */}
        <div className="bg-slate-900/85 backdrop-blur-2xl border border-slate-800/80 rounded-3xl p-7 sm:p-8 shadow-2xl shadow-black/80 w-full transition-all">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white tracking-tight">Yönetim Paneline Giriş</h2>
            <p className="text-slate-400 text-xs mt-1">Güvenli oturum açmak için kimlik bilgilerinizi girin</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div
                className={`p-3.5 rounded-2xl border text-xs animate-in fade-in slide-in-from-top-1 duration-200 ${
                  isLockoutError
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-lg shadow-rose-950/20'
                    : isWarningError
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-lg shadow-amber-950/20'
                    : isRateLimitError
                    ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 shadow-lg shadow-purple-950/20'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {isLockoutError ? (
                    <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                  ) : isWarningError ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : isRateLimitError ? (
                    <Clock className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[11px] uppercase tracking-wider mb-0.5">
                      {isLockoutError
                        ? 'Hesap Geçici Olarak Kilitlendi'
                        : isWarningError
                        ? 'Güvenlik Uyarısı'
                        : isRateLimitError
                        ? 'İşlem Sınırı Aşıldı'
                        : 'Giriş Başarısız'}
                    </p>
                    <p className="leading-relaxed opacity-95">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                E-posta Adresi
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  required
                  placeholder="ornek@spendlog.com"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/80 focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Şifre
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/80 focus:border-indigo-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 transition cursor-pointer"
                  title={showPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm active:scale-[0.99]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Kimlik Doğrulanıyor...</span>
                </>
              ) : (
                <>
                  <span>Güvenli Giriş Yap</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Güvenlik Mührü */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>256-Bit Uçtan Uca Şifreli & Güvenli Oturum</span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/60 text-center">
            <p className="text-xs text-slate-400">
              Hesabınız yok mu?{' '}
              <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold transition">
                Hemen Kaydolun
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Alt: Sola Kayan Dinamik Ürün Özellikleri Vitrini (Infinite Marquee) */}
      <div className="w-full relative z-10 py-4 border-t border-slate-800/60 bg-slate-950/70 backdrop-blur-md overflow-hidden">
        {/* Sağ & Sol Yumuşak Geçiş Maskeleri */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent z-20" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-l from-slate-950 via-slate-950/80 to-transparent z-20" />

        {/* Kayan Şerit Konteyneri */}
        <div className="animate-marquee gap-4 px-4">
          {duplicatedFeatures.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="flex items-center gap-3 bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/90 rounded-2xl px-4 py-2.5 shadow-md backdrop-blur-sm shrink-0 transition group cursor-default"
              >
                <div className={`w-8 h-8 rounded-xl ${item.bg} ${item.border} border flex items-center justify-center shrink-0 ${item.color} group-hover:scale-105 transition-transform`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-white tracking-wide">
                    {item.title}
                  </span>
                  <span className="text-[11px] text-slate-400 max-w-[280px] truncate">
                    {item.description}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
