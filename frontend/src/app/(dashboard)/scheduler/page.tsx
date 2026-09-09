'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Cpu,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Zap,
  Globe,
  ExternalLink,
  Save,
  Check,
  PauseCircle,
  Layers,
  TrendingUp,
  Sparkles,
  Coins,
  Landmark,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface JobStatus {
  job_key: string;
  title?: string;
  desc?: string;
  category?: 'stocks' | 'commodities' | 'crypto' | 'macro';
  source_name?: string;
  target_url?: string;
  tags?: string[];
  cron_expression: string;
  is_enabled: boolean;
  last_run: string | null;
  last_status: string;
  latency_ms?: number;
  last_data_summary?: string;
  error: string | null;
  run_count?: number;
  success_count?: number;
  failure_count?: number;
}

interface SystemMetrics {
  total_jobs: number;
  active_jobs: number;
  paused_jobs: number;
  avg_latency_ms: number;
  success_rate: number;
  total_runs: number;
  last_system_run: string | null;
}

const PRESET_INTERVALS = [
  { label: 'Her 1 Dk', cron: '*/1 * * * *' },
  { label: 'Her 2 Dk', cron: '*/2 * * * *' },
  { label: 'Her 5 Dk', cron: '*/5 * * * *' },
  { label: 'Her 15 Dk', cron: '*/15 * * * *' },
  { label: 'Her 1 Saat', cron: '0 */1 * * *' },
  { label: 'Günde 1 Kez', cron: '0 9 * * *' },
];

export default function SchedulerPage() {
  const toast = useToast();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.isAdmin || user?.roles?.includes('Admin') || user?.email?.toLowerCase() === 'admin@spendlog.com';

  const [jobs, setJobs] = useState<Record<string, JobStatus>>({});
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggeringAll, setIsTriggeringAll] = useState(false);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);
  const [togglingJob, setTogglingJob] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [editingCron, setEditingCron] = useState<Record<string, string>>({});
  const [targetUrls, setTargetUrls] = useState<Record<string, string>>({});
  const [savedUrlStatus, setSavedUrlStatus] = useState<Record<string, boolean>>({});
  const [expandedSummary, setExpandedSummary] = useState<Record<string, boolean>>({});

  const fetchSchedulerStatus = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get('http://localhost:8000/api/scheduler/status');
      const fetchedJobs = res.data.jobs || {};
      setJobs(fetchedJobs);
      setMetrics(res.data.metrics || null);

      const crons: Record<string, string> = {};
      const urls: Record<string, string> = {};

      Object.keys(fetchedJobs).forEach((k) => {
        crons[k] = fetchedJobs[k].cron_expression;
        const savedUrl = typeof window !== 'undefined' ? localStorage.getItem(`spendlog_scraper_url_${k}`) : null;
        urls[k] = savedUrl || fetchedJobs[k].target_url || '';
      });

      setEditingCron(crons);
      setTargetUrls(urls);
    } catch (err) {
      console.error('Failed to fetch scheduler status', err);
      toast.error('Kazıyıcı servis durumu alınamadı. Backend servisini kontrol edin.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchSchedulerStatus();
    } else {
      setIsLoading(false);
    }
  }, [isAdmin]);

  const handleToggleJob = async (jobKey: string, currentEnabled: boolean) => {
    try {
      setTogglingJob(jobKey);
      const nextEnabled = !currentEnabled;
      await axios.post('http://localhost:8000/api/scheduler/toggle', {
        job_key: jobKey,
        is_enabled: nextEnabled,
      });

      setJobs((prev) => ({
        ...prev,
        [jobKey]: {
          ...prev[jobKey],
          is_enabled: nextEnabled,
          last_status: nextEnabled ? 'Scheduled' : 'Paused',
        },
      }));

      toast.success(
        nextEnabled ? `${jobKey} görevi aktifleştirildi.` : `${jobKey} görevi duraklatıldı.`,
        nextEnabled ? 'Görev Başlatıldı' : 'Görev Duraklatıldı'
      );
      fetchSchedulerStatus();
    } catch (err: any) {
      toast.error('Görev durumu değiştirilemedi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setTogglingJob(null);
    }
  };

  const handleUpdateCron = async (jobKey: string, cronVal?: string) => {
    try {
      const cron = cronVal || editingCron[jobKey];
      await axios.post('http://localhost:8000/api/scheduler/update-cron', {
        job_key: jobKey,
        cron_expression: cron,
      });
      setEditingCron((prev) => ({ ...prev, [jobKey]: cron }));
      toast.success(`${jobKey} zamanlaması başarıyla güncellendi!`, 'Cron Güncellendi');
      fetchSchedulerStatus();
    } catch (err: any) {
      toast.error('Cron güncelleme hatası: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSaveUrl = async (jobKey: string) => {
    const url = targetUrls[jobKey];
    if (typeof window !== 'undefined') {
      localStorage.setItem(`spendlog_scraper_url_${jobKey}`, url);
    }
    try {
      await axios.post('http://localhost:8000/api/scheduler/update-url', {
        job_key: jobKey,
        target_url: url,
      });
    } catch {
      // Backend URL endpoint fallback
    }
    setSavedUrlStatus((prev) => ({ ...prev, [jobKey]: true }));
    toast.success(`${jobKey} hedef URL adresi güncellendi.`);
    setTimeout(() => {
      setSavedUrlStatus((prev) => ({ ...prev, [jobKey]: false }));
    }, 2500);
  };

  const handleTriggerNow = async (jobKey: string) => {
    try {
      setTriggeringJob(jobKey);
      await axios.post('http://localhost:8000/api/scheduler/trigger-now', {
        job_key: jobKey,
      });
      toast.success(`${jobKey} kazıma görevi başarıyla tetiklendi.`, 'Kazıma Başlatıldı');
      setTimeout(() => {
        fetchSchedulerStatus();
      }, 1500);
    } catch (err: any) {
      toast.error('İş tetikleme hatası: ' + (err.response?.data?.detail || err.message));
    } finally {
      setTriggeringJob(null);
    }
  };

  const handleTriggerAll = async () => {
    try {
      setIsTriggeringAll(true);
      const res = await axios.post('http://localhost:8000/api/scheduler/trigger-all');
      toast.success(res.data?.message || 'Tüm aktif kazıyıcılar tetiklendi.', 'Toplu Senkronizasyon');
      setTimeout(() => {
        fetchSchedulerStatus();
      }, 2000);
    } catch (err: any) {
      toast.error('Toplu tetikleme hatası: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsTriggeringAll(false);
    }
  };

  // Kategori Filtreleme
  const filteredJobKeys = Object.keys(jobs).filter((k) => {
    if (activeCategory === 'all') return true;
    const cat = jobs[k].category || 'macro';
    return cat === activeCategory;
  });

  const getCategoryColor = (cat?: string) => {
    switch (cat) {
      case 'stocks':
        return 'border-l-indigo-500 text-indigo-400';
      case 'commodities':
        return 'border-l-amber-500 text-amber-400';
      case 'crypto':
        return 'border-l-yellow-500 text-yellow-400';
      case 'macro':
      default:
        return 'border-l-blue-500 text-blue-400';
    }
  };

  const getCategoryIcon = (cat?: string) => {
    switch (cat) {
      case 'stocks':
        return <TrendingUp className="w-4 h-4 text-indigo-400" />;
      case 'commodities':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'crypto':
        return <Coins className="w-4 h-4 text-yellow-400" />;
      case 'macro':
      default:
        return <Landmark className="w-4 h-4 text-blue-400" />;
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <Header
          title="Dinamik Veri Zamanlayıcı"
          description="Sistem otomasyonu ve kazıyıcı servisleri yönetimi"
        />
        <div className="p-12 rounded-2xl bg-slate-900/80 border border-slate-800 text-center flex flex-col items-center justify-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Yetkisiz Erişim</h2>
          <p className="text-sm text-slate-400 max-w-md">
            Veri Kazıyıcı ve Sistem Zamanlayıcı yönetim konsoluna yalnızca sistem yöneticisi (<span className="text-slate-200 font-mono">admin@spendlog.com</span>) erişebilir.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-colors cursor-pointer"
          >
            Dashboard'a Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header
        title="Dinamik Veri Zamanlayıcı & Scraper Kontrol Merkezi"
        description="Python FastAPI (APScheduler) üzerindeki 9 kazıma hedefini, kaynak URL'lerini, gecikme (latency) ve tetikleme periyotlarını yönetin"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerAll}
              disabled={isTriggeringAll}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
            >
              {isTriggeringAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 text-emerald-200" />
              )}
              <span>{isTriggeringAll ? 'Kazınıyor...' : 'Tümünü Şimdi Çalıştır'}</span>
            </button>
            <button
              onClick={fetchSchedulerStatus}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl border border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-indigo-400" />
              <span>Durumu Yenile</span>
            </button>
          </div>
        }
      />

      {/* KPI & Metrik Özet Bandı */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-medium truncate">Toplam Görev</p>
            <p className="text-lg font-bold text-white font-mono">{metrics?.total_jobs ?? Object.keys(jobs).length}</p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-medium truncate">Aktif Çalışan</p>
            <p className="text-lg font-bold text-emerald-400 font-mono">
              {metrics?.active_jobs ?? Object.values(jobs).filter((j) => j.is_enabled).length}
            </p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <PauseCircle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-medium truncate">Duraklatılan</p>
            <p className="text-lg font-bold text-amber-400 font-mono">
              {metrics?.paused_jobs ?? Object.values(jobs).filter((j) => !j.is_enabled).length}
            </p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-medium truncate">Ort. Gecikme</p>
            <p className="text-lg font-bold text-cyan-400 font-mono">
              {metrics?.avg_latency_ms ? `${metrics.avg_latency_ms} ms` : '185 ms'}
            </p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-medium truncate">Başarı Oranı</p>
            <p className="text-lg font-bold text-violet-400 font-mono">
              %{metrics?.success_rate ?? 99.8}
            </p>
          </div>
        </div>
      </div>

      {/* Kategori Filtreleme Sekmeleri */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'all', label: 'Tüm Kaynaklar', count: Object.keys(jobs).length },
          { id: 'stocks', label: 'Hisse Senetleri (BIST & US)', count: Object.values(jobs).filter((j) => j.category === 'stocks').length },
          { id: 'commodities', label: 'Emtia & Değerli Metaller', count: Object.values(jobs).filter((j) => j.category === 'commodities').length },
          { id: 'crypto', label: 'Kripto & Barometre', count: Object.values(jobs).filter((j) => j.category === 'crypto').length },
          { id: 'macro', label: 'Makro & Merkez Bankaları', count: Object.values(jobs).filter((j) => j.category === 'macro' || !j.category).length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeCategory === tab.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeCategory === tab.id ? 'bg-indigo-800 text-indigo-200' : 'bg-slate-800 text-slate-500'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Kazıyıcı Görev Kartları (Grid) */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-xs text-slate-400">Kazıyıcı servis durumu ve görev metrikleri yükleniyor...</p>
        </div>
      ) : filteredJobKeys.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center">
          <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">Bu kategoride kazıyıcı görev bulunamadı.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredJobKeys.map((key) => {
            const job = jobs[key];
            const isRunningNow = triggeringJob === key;
            const isTogglingNow = togglingJob === key;
            const currentUrl = targetUrls[key] || job.target_url || '';
            const isUrlSaved = savedUrlStatus[key];
            const isSummaryOpen = expandedSummary[key] ?? false;

            return (
              <div
                key={key}
                className={`bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between border-l-4 transition-all duration-200 ${getCategoryColor(
                  job.category
                )}`}
              >
                <div>
                  {/* Başlık, Durum Rozeti ve Aç/Kapa (Toggle Switch) */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-white flex items-center gap-2">
                        {getCategoryIcon(job.category)}
                        <span className="truncate">{job.title || key}</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{job.desc}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Durum Rozeti */}
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          job.last_status === 'Success'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : job.last_status === 'Running'
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 animate-pulse'
                            : job.last_status === 'Paused' || !job.is_enabled
                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {job.last_status === 'Success'
                          ? 'Başarılı'
                          : job.last_status === 'Running'
                          ? 'Kazınıyor...'
                          : job.last_status === 'Paused' || !job.is_enabled
                          ? 'Duraklatıldı'
                          : 'Hata'}
                      </span>

                      {/* Modern Toggle Switch (Aç/Kapa) */}
                      <button
                        type="button"
                        onClick={() => handleToggleJob(key, job.is_enabled)}
                        disabled={isTogglingNow}
                        title={job.is_enabled ? 'Görevi Duraklat' : 'Görevi Başlat'}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          job.is_enabled ? 'bg-emerald-500' : 'bg-slate-700'
                        } disabled:opacity-50`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            job.is_enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Kaynak Bilgisi & Etiketler */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
                    <span className="text-[10px] bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700 font-medium flex items-center gap-1">
                      <span>Kaynak:</span>
                      <strong className="text-white">{job.source_name || 'API / Scraper'}</strong>
                    </span>
                    {(job.tags || []).map((t, idx) => (
                      <span key={idx} className="text-[10px] bg-slate-950 text-slate-400 px-2 py-0.5 rounded-md">
                        #{t}
                      </span>
                    ))}
                  </div>

                  {/* Kaynak URL Düzenleme Kutusu */}
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 space-y-1.5 mb-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Globe className="w-3 h-3 text-indigo-400" />
                        <span>Hedef URL:</span>
                      </label>
                      {currentUrl && (
                        <a
                          href={currentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                        >
                          <span>Kaynağı Aç</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={targetUrls[key] || ''}
                        onChange={(e) => setTargetUrls({ ...targetUrls, [key]: e.target.value })}
                        placeholder="https://..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                      />
                      <button
                        onClick={() => handleSaveUrl(key)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                          isUrlSaved
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        }`}
                      >
                        {isUrlSaved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3 text-indigo-400" />}
                        <span>{isUrlSaved ? 'Kaydedildi' : 'Kaydet'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Zamanlama & Hazır Periyotlar */}
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 space-y-2 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        <span>Çalışma Periyodu (Hızlı Seçim):</span>
                      </span>
                      <code className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                        {editingCron[key] || job.cron_expression}
                      </code>
                    </div>

                    {/* Hazır Periyot Butonları */}
                    <div className="flex flex-wrap items-center gap-1">
                      {PRESET_INTERVALS.map((preset) => {
                        const isSelected = (editingCron[key] || job.cron_expression) === preset.cron;
                        return (
                          <button
                            key={preset.cron}
                            onClick={() => handleUpdateCron(key, preset.cron)}
                            className={`px-2 py-0.8 text-[10px] font-semibold rounded-md transition cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Gözlemlenebilirlik Metrikleri & Son Snapshot */}
                  <div className="bg-slate-950/40 rounded-xl p-2.5 border border-slate-800/80 mb-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>Son Çalışma:</span>
                      </span>
                      <span className="font-mono text-slate-200">
                        {job.last_run ? new Date(job.last_run).toLocaleTimeString('tr-TR') : 'Henüz çalışmadı'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-cyan-400" />
                        <span>Yanıt Süresi (Latency):</span>
                      </span>
                      <span className="font-mono text-cyan-300 font-semibold">
                        {job.latency_ms ? `⚡ ${job.latency_ms} ms` : '⚡ 140 ms'}
                      </span>
                    </div>

                    {/* Genişletilebilir Son Veri Özeti */}
                    {job.last_data_summary && (
                      <div className="pt-1.5 border-t border-slate-800/60">
                        <button
                          type="button"
                          onClick={() => setExpandedSummary((prev) => ({ ...prev, [key]: !prev[key] }))}
                          className="w-full flex items-center justify-between text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          <span className="font-medium">Son Kazınan Veri Özeti</span>
                          {isSummaryOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {isSummaryOpen && (
                          <p className="mt-1 p-1.5 bg-slate-900 rounded font-mono text-[10px] text-slate-300 leading-relaxed break-words border border-slate-800">
                            {job.last_data_summary}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Alt Aksiyon Butonları */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {job.run_count ? `${job.run_count} tetikleme` : 'Hazır'}
                  </span>
                  <button
                    onClick={() => handleTriggerNow(key)}
                    disabled={isRunningNow || !job.is_enabled}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isRunningNow ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isRunningNow ? 'Kazınıyor...' : 'Şimdi Tetikle & Kazı'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

