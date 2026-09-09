'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-red-400 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white">Beklenmeyen Bir Durum Oluştu</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Arayüz bileşeni yüklenirken bir hata meydana geldi. Verileriniz güvende, sayfayı yenileyerek tekrar deneyebilirsiniz.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-left font-mono text-[11px] text-red-400/90 overflow-x-auto max-h-28">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs py-2.5 px-4 rounded-xl transition shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sayfayı Yenile</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs py-2.5 px-3 rounded-xl transition cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Ana Sayfa</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
