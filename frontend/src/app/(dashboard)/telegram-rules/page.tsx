'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/axios';
import {
  TelegramRule,
  TelegramSendType,
  TelegramScheduleType,
  TelegramFrequency,
} from '@/types/telegram';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import {
  Bot,
  Plus,
  Trash2,
  Edit2,
  Terminal,
  Loader2,
  X,
  Check,
  Zap,
  Key,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Unlink,
  Eye,
  EyeOff,
  Camera,
  CreditCard,
  Wallet,
  Activity,
  Clock,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Layers,
  Calendar,
  Repeat,
} from 'lucide-react';

interface BotStatus {
  hasCustomBot: boolean;
  customBotUsername?: string | null;
  webhookConfigured: boolean;
  chatId?: number | null;
  isTelegramActive: boolean;
}

export default function TelegramRulesPage() {
  const toast = useToast();
  const [rules, setRules] = useState<TelegramRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Bot Status State
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [botTokenInput, setBotTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isConnectingBot, setIsConnectingBot] = useState(false);

  // Akıllı Telegram Router: Masaüstü Telegram yüklüyse doğrudan Desktop'ı uyandırır
  const openTelegramApp = (username: string) => {
    if (!username) return;
    const cleanUsername = username.replace(/^@/, '');
    const tgProtocol = `tg://resolve?domain=${cleanUsername}`;
    const webUrl = `https://t.me/${cleanUsername}`;

    const start = Date.now();
    window.location.href = tgProtocol;

    setTimeout(() => {
      if (!document.hidden && Date.now() - start < 1800) {
        window.open(webUrl, '_blank', 'noopener,noreferrer');
      }
    }, 600);
  };

  // Confirm Modal State
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Rule Modal State (MSSQL Agent Scheduler & Gönderim Türü Tarzı)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TelegramRule | null>(null);
  const [command, setCommand] = useState('');
  const [description, setDescription] = useState('');
  const [responseTemplate, setResponseTemplate] = useState('');
  const [sendType, setSendType] = useState<TelegramSendType>('Text');
  const [scheduleType, setScheduleType] = useState<TelegramScheduleType>('Manual');
  const [frequency, setFrequency] = useState<TelegramFrequency>('Daily');
  const [executionTime, setExecutionTime] = useState('09:00');
  const [intervalMinutes, setIntervalMinutes] = useState<number>(30);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchBotStatus = async () => {
    try {
      const res = await api.get<BotStatus>('/api/telegram/my-bot');
      setBotStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch bot status', err);
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const rulesRes = await api.get<TelegramRule[]>('/api/telegramrules');
      setRules(rulesRes.data);
      await fetchBotStatus();
    } catch (err) {
      console.error('Failed to fetch telegram data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConnectCustomBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botTokenInput.trim()) {
      toast.error('Lütfen BotFather tarafından verilen API Token değerini girin.');
      return;
    }

    setIsConnectingBot(true);
    try {
      const res = await api.post('/api/telegram/my-bot/connect', {
        botToken: botTokenInput.trim(),
      });

      toast.success(res.data?.message || 'Özel Telegram botu başarıyla bağlandı!', 'Bot Aktif Edildi');
      setBotTokenInput('');
      await fetchBotStatus();
    } catch (err: any) {
      console.error('Bot connection error', err);
      toast.error(err.response?.data?.message || 'Bot bağlanırken hata oluştu. Token değerini kontrol edin.');
    } finally {
      setIsConnectingBot(false);
    }
  };

  const handleDisconnectCustomBot = () => {
    setConfirmModalState({
      isOpen: true,
      title: 'Kişisel Bot Bağlantısını Kes',
      message: `Özel bot bağlantısını sonlandırmak istediğinize emin misiniz? Bot üzerindeki işlemler durdurulacaktır.`,
      onConfirm: async () => {
        try {
          await api.post('/api/telegram/my-bot/disconnect');
          toast.success('Özel bot bağlantısı kaldırıldı.');
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          await fetchBotStatus();
        } catch (err: any) {
          toast.error('Bot bağlantısı kesilirken hata: ' + (err.response?.data?.message || err.message));
        }
      },
    });
  };

  const openCreateModal = () => {
    setEditingRule(null);
    setCommand('');
    setDescription('');
    setResponseTemplate('✅ İşlem kaydedildi: {tutar} ₺ ({kategori})');
    setSendType('Text');
    setScheduleType('Manual');
    setFrequency('Daily');
    setExecutionTime('09:00');
    setIntervalMinutes(30);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (rule: TelegramRule) => {
    setEditingRule(rule);
    setCommand(rule.command);
    setDescription(rule.description || '');
    setResponseTemplate(rule.responseTemplate || '');
    setSendType(rule.sendType || 'Text');
    setScheduleType(rule.scheduleType || 'Manual');
    setFrequency(rule.frequency || 'Daily');
    setExecutionTime(rule.executionTime || '09:00');
    setIntervalMinutes(rule.intervalMinutes || 30);
    setIsActive(rule.isActive);
    setIsModalOpen(true);
  };

  const toggleRuleStatus = async (rule: TelegramRule) => {
    try {
      const updatedStatus = !rule.isActive;
      await api.put(`/api/telegramrules/${rule.id}`, {
        ...rule,
        isActive: updatedStatus,
      });
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, isActive: updatedStatus } : r))
      );
      toast.success(`"${rule.command}" kuralı ${updatedStatus ? 'aktifleştirildi' : 'devre dışı bırakıldı'}.`);
    } catch (err: any) {
      toast.error('Kural durumu güncellenirken hata: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) {
      toast.error('Lütfen bir komut veya tetikleyici anahtar kelime girin.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        command: command.trim(),
        title: command.trim(),
        description: description.trim(),
        responseTemplate: responseTemplate.trim(),
        sendType,
        scheduleType,
        frequency,
        executionTime,
        intervalMinutes: scheduleType === 'Recurring' && frequency === 'Interval' ? Number(intervalMinutes) : null,
        isActive,
      };

      if (editingRule) {
        await api.put(`/api/telegramrules/${editingRule.id}`, {
          id: editingRule.id,
          ...payload,
        });
        toast.success('Telegram kuralı başarıyla güncellendi.');
      } else {
        await api.post('/api/telegramrules', payload);
        toast.success('Telegram kuralı başarıyla oluşturuldu.');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Failed to save telegram rule', err);
      toast.error('Telegram kuralı kaydedilirken hata oluştu: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number, cmd: string) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Kuralı Sil',
      message: `"${cmd}" komutuna ait Telegram kuralını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      onConfirm: async () => {
        try {
          await api.delete(`/api/telegramrules/${id}`);
          toast.success(`"${cmd}" kuralı başarıyla silindi.`);
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          fetchData();
        } catch (err: any) {
          console.error('Failed to delete telegram rule', err);
          toast.error('Kural silinirken hata oluştu: ' + (err.response?.data?.detail || err.message));
        }
      },
    });
  };

  const getScheduleSummary = (
    sType: TelegramScheduleType,
    freq: TelegramFrequency,
    execTime: string,
    intMin: number
  ): string => {
    if (sType === 'Manual') {
      return 'Kullanıcı Telegram üzerinden komutu yazdığında anında tetiklenir.';
    }
    if (freq === 'Daily') {
      return `Her gün saat ${execTime || '09:00'}'da otomatik olarak Telegram'a gönderilir.`;
    }
    if (freq === 'Weekly') {
      return `Haftanın belirlenen günlerinde saat ${execTime || '09:00'}'da otomatik gönderilir.`;
    }
    if (freq === 'Interval') {
      return `Günün her anında her ${intMin || 30} dakikada bir düzenli kontrol edilip gönderilir.`;
    }
    return '';
  };

  const renderSendTypeBadge = (st: TelegramSendType) => {
    switch (st) {
      case 'Image':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-md">
            <ImageIcon className="w-3 h-3 text-purple-400" />
            <span>Görsel / Grafik</span>
          </span>
        );
      case 'Pdf':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded-md">
            <FileSpreadsheet className="w-3 h-3 text-rose-400" />
            <span>PDF Ekstresi</span>
          </span>
        );
      case 'ChartAndPdf':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md">
            <Layers className="w-3 h-3 text-indigo-400" />
            <span>Grafik + PDF</span>
          </span>
        );
      case 'Text':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/60 px-2 py-0.5 rounded-md">
            <FileText className="w-3 h-3 text-slate-400" />
            <span>Metin</span>
          </span>
        );
    }
  };

  const renderScheduleBadge = (rule: TelegramRule) => {
    if (rule.command === 'EVENT_PRICE_ALERT') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded-md">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Piyasa Tetiklemeli (Anlık)</span>
        </span>
      );
    }
    if (rule.scheduleType === 'Recurring') {
      if (rule.frequency === 'Interval') {
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 px-2 py-0.5 rounded-md">
            <Repeat className="w-3 h-3 text-cyan-400" />
            <span>{rule.intervalMinutes || 30} dk arayla</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded-md">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>Günlük {rule.executionTime || '09:00'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
        <Terminal className="w-3 h-3 text-slate-500" />
        <span>Tetikleyici / Komutla</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <Header
        title="Kişisel Telegram Asistanı & Görev Yönetimi"
        description="Bot komutlarını, MSSQL Job Scheduler tarzı periyodik raporlamaları ve gönderim türlerini yönetin"
        actions={
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Kural Tanımla</span>
          </button>
        }
      />

      {/* 🤖 KİŞİSEL TELEGRAM BOT ENTEGRASYON KARTI */}
      {botStatus?.hasCustomBot ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/20 space-y-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="font-bold text-base text-white">Kişisel Telegram Finans Asistanınız</h2>
                  <span className="text-xs bg-emerald-500/15 text-emerald-400 font-mono font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    @{botStatus.customBotUsername}
                  </span>
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-300 font-semibold px-2 py-0.5 rounded-md border border-indigo-500/20 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-indigo-400" />
                    %100 İzole Webhook Router
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Botunuz yalnızca sizin SpendLog hesabınıza mühürlüdür. Komutlarınız sıfır thread maliyetli stateless router ile izole olarak işlenir.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-stretch md:self-auto">
              <button
                type="button"
                onClick={() => openTelegramApp(botStatus.customBotUsername || '')}
                className="flex-1 md:flex-none px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Sohbeti Aç</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleDisconnectCustomBot}
                className="px-3.5 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-300 border border-rose-500/30 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                title="Bot bağlantısını kes"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Bağlantıyı Kes</span>
              </button>
            </div>
          </div>

          {/* Hazır Komut Vitrini */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Kişisel Botunuzda Kullanabileceğiniz Hazır Komutlar ve Olaylar:</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-indigo-400 font-mono font-bold text-xs">
                  <Wallet className="w-3.5 h-3.5" />
                  <span>/bakiye</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Sadece vadesiz banka hesaplarınızın bakiyelerini ve toplam likit tutarı döker.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-indigo-400 font-mono font-bold text-xs">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>/kk 450 market</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Sıradaki canlı ekstre dönemine harcama notu ekler. Mükerrer korumalıdır.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-indigo-400 font-mono font-bold text-xs">
                  <Layers className="w-3.5 h-3.5" />
                  <span>2026-8 veya /rapor</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Belirtilen ayın kategori harcama donut grafiğini (PNG) ve detaylı PDF dökümünü iletir.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-indigo-400 font-mono font-bold text-xs">
                  <Activity className="w-3.5 h-3.5" />
                  <span>/durum</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Backend uptime, MSSQL ping ve scraper mikroservis çalışma durumunu test eder.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-xs">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Fiyat Alarmı</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Hedefe ulaşan varlıklar için dinamik şablonla anında Telegram bildirimi iletir.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-white">Özel Telegram Botunuzu 60 Saniyede Bağlayın</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              BotFather üzerinden kendi adınıza ücretsiz bir bot oluşturun, token'ı buraya girin ve botunuz SpendLog hesabınıza mühürlensin.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                    1
                  </span>
                  <span className="text-[10px] text-indigo-400 font-mono">Telegram</span>
                </div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-indigo-400" />
                  <span>BotFather'ı Açın</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Telegram uygulamasında <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300 font-mono text-[11px]">@BotFather</code> ile sohbet başlatın ve <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300 font-mono text-[11px]">/newbot</code> komutunu gönderin.
                </p>
              </div>

              <button
                type="button"
                onClick={() => openTelegramApp('BotFather')}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>BotFather'ı Aç</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                    2
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono">Token</span>
                </div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>API Token'ı Kopyalayın</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  BotFather'ın mesaj sonunda verdiği <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300 font-mono text-[11px]">123456789:AA...</code> biçimindeki özel API erişim token'ını kopyalayın.
                </p>
              </div>

              <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Banka düzeyinde izole kasa ile korunur</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950/80 border border-indigo-500/30 flex flex-col justify-between space-y-4 shadow-lg shadow-indigo-950/20">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                    3
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">Aktifleştir</span>
                </div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <span>Bağlantıyı Tamamlayın</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Kopyaladığınız token'ı aşağıdaki kutuya yapıştırıp doğrula butonuna basın:
                </p>
              </div>

              <form onSubmit={handleConnectCustomBot} className="space-y-2.5">
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={botTokenInput}
                    onChange={(e) => setBotTokenInput(e.target.value)}
                    placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-8 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isConnectingBot}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold py-2 px-3 rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isConnectingBot ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-emerald-200" />
                  )}
                  <span>Botumu Doğrula ve Bağla</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SADELEŞTİRİLMİŞ DİNAMİK KOMUT & SCHEDULER KURALLARI LİSTESİ */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-sm text-white">Tanımlı Telegram Komut ve Zamanlanmış Görevleri</h3>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
              {rules.length} Görev
            </span>
          </div>
        </div>

        {/* Kurallar Tablosu (Dar Satır Yüksekliği: py-2 px-3) */}
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Komut / Tetikleyici</th>
                    <th className="py-2.5 px-3">Açıklama</th>
                    <th className="py-2.5 px-3">Gönderim Türü</th>
                    <th className="py-2.5 px-3">Zamanlama / Sıklık</th>
                    <th className="py-2.5 px-3">Durum</th>
                    <th className="py-2.5 px-3 text-center w-24">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {rules.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2 px-3 whitespace-nowrap">
                        {r.command === 'EVENT_PRICE_ALERT' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md text-[11px] flex items-center gap-1">
                              <Zap className="w-3 h-3 text-amber-400" />
                              <span>Fiyat Alarmları</span>
                            </span>
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                              Sistem
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md text-[11px]">
                            {r.command}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-200 font-medium max-w-sm truncate">
                        {r.description || r.title || 'Açıklama belirtilmedi'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {renderSendTypeBadge(r.sendType)}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium">
                        {renderScheduleBadge(r)}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleRuleStatus(r)}
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full transition cursor-pointer ${
                            r.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                          }`}
                          title="Durumu değiştirmek için tıklayın"
                        >
                          {r.isActive ? 'Aktif' : 'Devre Dışı'}
                        </button>
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(r)}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="Düzenle"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id, r.command)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                            title="Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MSSQL Agent Job Scheduler Tarzı Kural Tanımlama Modalı */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">
                  {editingRule ? 'Telegram Kuralını / Görevini Düzenle' : 'Yeni Telegram Kuralı / Görevi Tanımla'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* 1. Komut / Tetikleyici */}
              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Komut / Tetikleyici Anahtar Kelime *
                </label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  required
                  placeholder="Örn: /bakiye, /harca, 2026-8 veya durum"
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 2. Açıklama (1.1 - Serbest Metin) */}
              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Açıklama / Görev Amacı *
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  placeholder="Örn: Vadesiz banka bakiyelerimi listeler / Aylık harcama grafiği üretir"
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 3. Gönderim Türü (1.3.1 - Text, Image, Pdf, ChartAndPdf) */}
              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Telegram Gönderim Türü (Send Type)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setSendType('Text')}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                      sendType === 'Text'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <span>Metin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSendType('Image')}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                      sendType === 'Image'
                        ? 'bg-purple-600/20 border-purple-500 text-white font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4 text-purple-400" />
                    <span>Görsel / Grafik</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSendType('Pdf')}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                      sendType === 'Pdf'
                        ? 'bg-rose-600/20 border-rose-500 text-white font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-rose-400" />
                    <span>Belge / PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSendType('ChartAndPdf')}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                      sendType === 'ChartAndPdf'
                        ? 'bg-emerald-600/20 border-emerald-500 text-white font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Grafik + PDF</span>
                  </button>
                </div>
              </div>

              {/* 4. MSSQL Job Scheduler Tarzı Zamanlama Ayarları (1.3) */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Zamanlama Modu (Job Scheduler)</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduleType('Manual')}
                    className={`py-2 px-3 rounded-lg border text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      scheduleType === 'Manual'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Tetikleyici / Komutla</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScheduleType('Recurring')}
                    className={`py-2 px-3 rounded-lg border text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      scheduleType === 'Recurring'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Zamanlanmış (Recurring)</span>
                  </button>
                </div>

                {scheduleType === 'Recurring' && (
                  <div className="pt-2 border-t border-slate-800/70 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Sıklık (Frequency)</label>
                        <select
                          value={frequency}
                          onChange={(e) => setFrequency(e.target.value as TelegramFrequency)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                        >
                          <option value="Daily">Günlük (Daily)</option>
                          <option value="Weekly">Haftalık (Weekly)</option>
                          <option value="Interval">Belirli Aralıklarla (Interval)</option>
                        </select>
                      </div>

                      {frequency === 'Interval' ? (
                        <div>
                          <label className="block text-slate-400 mb-1">Aralık (Dakika)</label>
                          <select
                            value={intervalMinutes}
                            onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                          >
                            <option value={15}>15 Dakikada Bir</option>
                            <option value={30}>30 Dakikada Bir</option>
                            <option value={60}>1 Saatte Bir</option>
                            <option value={120}>2 Saatte Bir</option>
                            <option value={240}>4 Saatte Bir</option>
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-slate-400 mb-1">Çalışma Saati (HH:mm)</label>
                          <input
                            type="time"
                            value={executionTime}
                            onChange={(e) => setExecutionTime(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono"
                          />
                        </div>
                      )}
                    </div>

                    {/* MSSQL SSMS Tarzı Dinamik Özet Kutusu */}
                    <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-white block">Zamanlama Özeti:</span>
                        <p className="text-slate-300 mt-0.5">
                          {getScheduleSummary(scheduleType, frequency, executionTime, intervalMinutes)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Yanıt / Bildirim Şablonu (Response Template) */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Telegram Yanıt / Bildirim Şablonu</span>
                  </label>
                  {command === 'EVENT_PRICE_ALERT' && (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-mono">
                      Fiyat Alarmı Formatı
                    </span>
                  )}
                </div>

                <textarea
                  value={responseTemplate}
                  onChange={(e) => setResponseTemplate(e.target.value)}
                  rows={4}
                  placeholder="Telegram'a iletilecek mesaj formatı..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-y"
                />

                {command === 'EVENT_PRICE_ALERT' ? (
                  <div className="text-[10px] text-slate-400 space-y-1">
                    <span className="text-slate-300 font-semibold block">Kullanılabilir Dinamik Değişkenler (Tıklayıp Ekleyin):</span>
                    <div className="flex flex-wrap gap-1">
                      {['{Symbol}', '{Name}', '{TargetPrice}', '{CurrentPrice}', '{Currency}', '{Condition}', '{Note}', '{Time}'].map((placeholder) => (
                        <button
                          key={placeholder}
                          type="button"
                          onClick={() => setResponseTemplate((prev) => prev + ' ' + placeholder)}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono text-[10px] border border-slate-700 transition cursor-pointer"
                          title="Şablona ekle"
                        >
                          + {placeholder}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500">
                    Örn: <code className="text-slate-400">{`✅ İşlem kaydedildi: {tutar} ₺ ({kategori})`}</code>
                  </p>
                )}
              </div>

              {/* 6. Aktiflik Durumu */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="isActive" className="font-semibold text-slate-300 cursor-pointer">
                  Kural / Görev Aktif Olsun
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingRule ? 'Güncelle' : 'Görevi Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Onay Modalı */}
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
