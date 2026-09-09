'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { Loader2 } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Sayfa yenilendiğinde (F5) localStorage kontrolü yap
    if (typeof window !== 'undefined') {
      const authData = localStorage.getItem('spendlog_auth');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          if (parsed.state?.accessToken && parsed.state?.isAuthenticated) {
            setIsReady(true);
            return;
          }
        } catch (e) {
          console.error('Auth parse error', e);
        }
      }
    }

    if (hasHydrated) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else {
        setIsReady(true);
      }
    }
  }, [hasHydrated, isAuthenticated, router]);

  if (!isReady && (!hasHydrated || !isAuthenticated)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-xs text-slate-400 font-medium">Oturum doğrulanıyor...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
