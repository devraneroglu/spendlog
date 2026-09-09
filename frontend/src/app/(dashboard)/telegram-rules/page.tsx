'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/axios';
import { TelegramRule, TelegramActionType } from '@/types/telegram';
import { Account, Category } from '@/types/finance';
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
} from 'lucide-react';

const ACTION_TYPE_LABELS: Record<TelegramActionType, string> = {
  [TelegramActionType.QueryBalance]: 'Bakiye Sorgulama',
  [TelegramActionType.AddExpense]: 'Harcama Ekle (Gider)',
  [TelegramActionType.AddIncome]: 'Gelir Ekle',
  [TelegramActionType.Transfer]: 'Hesaplar Arası Transfer',
};

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Bot Status State
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [botTokenInput, setBotTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isConnectingBot, setIsConnectingBot] = useState(false);

  // Akıllı Telegram Router: Masaüstü Telegram yüklüyse doğrudan Desktop'ı uyandırır, değilse tarayıcıda açar
  const openTelegramApp = (username: string) => {
    if (!username) return;
    const cleanUsername = username.replace(/^@/, '');
    const tgProtocol = `tg://resolve?domain=${cleanUsername}`;
    const webUrl = `https://t.me/${cleanUsername}`;

    const start = Date.now();
    // 1. İşletim sisteminde yüklü Telegram Desktop'ı çağırmayı dene
    window.location.href = tgProtocol;

    // 2. Masaüstü uygulaması açılmazsa (pencere odağı kaybolmazsa) tarayıcı sekmesinde aç
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

  // Rule Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TelegramRule | null>(null);
  const [command, setCommand] = useState('');
  const [pattern, setPattern] = useState('');
  const [actionType, setActionType] = useState<TelegramActionType>(TelegramActionType.AddExpense);
  const [targetAccountId, setTargetAccountId] = useState<number | ''>('');
  const [targetCategoryId, setTargetCategoryId] = useState<number | ''>('');
  const [responseTemplate, setResponseTemplate] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
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
      const [rulesRes, accountsRes, categoriesRes] = await Promise.all([
        api.get<TelegramRule[]>('/api/telegramrules'),
        api.get<Account[]>('/api/accounts'),
        api.get<Category[]>('/api/categories'),
      ]);
      setRules(rulesRes.data);
      setAccounts(accountsRes.data);
      setCategories(categoriesRes.data);
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
    setCommand('/harca');
    setPattern('^/harca\\s+(?<amount>[\\d.,]+)\\s*(?<desc>.*)$');
    setActionType(TelegramActionType.AddExpense);
    setTargetAccountId(accounts[0]?.id || '');
    setTargetCategoryId('');
    setResponseTemplate('✅ {amount} ₺ harcamanız kaydedildi.');
    setIsEnabled(true);
    setIsModalOpen(true);
  };

  const openEditModal = (rule: TelegramRule) => {
    setEditingRule(rule);
    setCommand(rule.command);
    setPattern(rule.pattern);
    setActionType(rule.actionType);
    setTargetAccountId(rule.targetAccountId || '');
    setTargetCategoryId(rule.targetCategoryId || '');
    setResponseTemplate(rule.responseMessageTemplate || '');
    setIsEnabled(rule.isEnabled);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingRule) {
        await api.put(`/api/telegramrules/${editingRule.id}`, {
          id: editingRule.id,
          command,
          pattern,
          actionType,
          targetAccountId: targetAccountId ? Number(targetAccountId) : null,
          targetCategoryId: targetCategoryId ? Number(targetCategoryId) : null,
          responseMessageTemplate: responseTemplate,
          isEnabled,
        });
        toast.success('Telegram kuralı başarıyla güncellendi.');
      } else {
        await api.post('/api/telegramrules', {
          command,
          pattern,
          actionType,
          targetAccountId: targetAccountId ? Number(targetAccountId) : null,
          targetCategoryId: targetCategoryId ? Number(targetCategoryId) : null,
          responseMessageTemplate: responseTemplate,
          isEnabled,
        });
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

  return (
    <div className="space-y-6">
      <Header
        title="Kişisel Telegram Asistanı & Kural Merkezi"
        description="Tamamen size özel Telegram botunuzu bağlayın, anlık harcama/bakiye komutlarını ve fiş OCR kurallarını yönetin"
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
        /* DURUM A: BOT BAŞARIYLA BAĞLI VE DEVREDE */
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
              <span>Kişisel Botunuzda Kullanabileceğiniz Hazır Komutlar:</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-indigo-400 font-mono font-bold text-xs">
                  <Wallet className="w-3.5 h-3.5" />
                  <span>/bakiye</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Tüm banka, nakit ve yatırım hesaplarınızın güncel bakiyelerini ve toplam likit servetinizi döker.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-indigo-400 font-mono font-bold text-xs">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>/kk 450 market</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Sıradaki canlı ekstre dönemine anında harcama notu ekler. Mükerrer harcama korumalıdır.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-indigo-400 font-mono font-bold text-xs">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Fiş Fotoğrafı / Yakıt</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Akaryakıt fişi görselini doğrudan bota atın; Vision AI ile tutar, istasyon ve araç km'sini otomatik işler.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-indigo-400 font-mono font-bold text-xs">
                  <Activity className="w-3.5 h-3.5" />
                  <span>/durum</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Backend uptime, MSSQL ping süresi ve scraper mikroservisi çalışma durumunu anlık test eder.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* DURUM B: HENÜZ BOT BAĞLI DEĞİL — 3 ADIMLI ŞIK KURULUM SİHİRBAZI */
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-base text-white">3 Kolay Adımda Kişisel Finans Asistanınızı Kurun</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Telegram üzerinde yalnızca size özel çalışacak, başkaları tarafından asla erişilemeyecek ve finansal verilerinizi güvenle yönetecek kişisel botunuzu 1 dakika içinde bağlayın.
            </p>
          </div>

          {/* 3 Adımlı Kart Izgarası */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. ADIM: BOT OLUŞTUR */}
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/90 flex flex-col justify-between space-y-4 hover:border-slate-700 transition">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                    1
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Telegram</span>
                </div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-indigo-400" />
                  <span>Botunuzu Oluşturun</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Telegram'da resmi <strong className="text-slate-200 font-mono">@BotFather</strong> botunu açın ve <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300 font-mono">/newbot</code> komutunu gönderin. Botunuza bir isim ve kullanıcı adı belirleyin.
                </p>
              </div>

              <button
                type="button"
                onClick={() => openTelegramApp('BotFather')}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>@BotFather'ı Aç</span>
                <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              </button>
            </div>

            {/* 2. ADIM: TOKEN AL */}
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/90 flex flex-col justify-between space-y-4 hover:border-slate-700 transition">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-500/30">
                    2
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">HTTP API Token</span>
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
                <span>Banka düzeyinde 256-bit izole kasa ile korunur</span>
              </div>
            </div>

            {/* 3. ADIM: DOĞRULA VE BAĞLA */}
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

      {/* DİNAMİK KOMUT & REGEX KURALLARI LİSTESİ */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-sm text-white">Tanımlı Telegram Komut ve Kuralları</h3>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
              {rules.length} Kural
            </span>
          </div>
        </div>

        {/* Rules Table */}
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
                    <th className="p-3.5">Komut / Tetikleyici</th>
                    <th className="p-3.5">Regex Deseni</th>
                    <th className="p-3.5">Eylem Türü</th>
                    <th className="p-3.5">Varsayılan Hesap</th>
                    <th className="p-3.5">Durum</th>
                    <th className="p-3.5 text-center">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {rules.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5">
                        <span className="font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-md">
                          {r.command}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-400 max-w-xs truncate">
                        {r.pattern}
                      </td>
                      <td className="p-3.5 font-semibold text-slate-200">
                        {ACTION_TYPE_LABELS[r.actionType]}
                      </td>
                      <td className="p-3.5 text-slate-400">
                        {r.targetAccountName || 'Tüm Hesaplar / Otomatik'}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            r.isEnabled
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {r.isEnabled ? 'Aktif' : 'Devre Dışı'}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(r)}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id, r.command)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">
                {editingRule ? 'Kuralı Düzenle' : 'Yeni Telegram Kuralı Ekle'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Komut / Anahtar Kelime
                </label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  required
                  placeholder="/harca veya bakiye"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Eylem Türü
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(Number(e.target.value))}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={TelegramActionType.QueryBalance}>Bakiye Sorgulama</option>
                  <option value={TelegramActionType.AddExpense}>Harcama Ekle (Gider)</option>
                  <option value={TelegramActionType.AddIncome}>Gelir Ekle</option>
                  <option value={TelegramActionType.Transfer}>Hesaplar Arası Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Regex Deseni
                </label>
                <input
                  type="text"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  required
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Hedef Hesap (Opsiyonel)
                  </label>
                  <select
                    value={targetAccountId}
                    onChange={(e) => setTargetAccountId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Otomatik / İlk Hesap</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Kategori (Opsiyonel)
                  </label>
                  <select
                    value={targetCategoryId}
                    onChange={(e) => setTargetCategoryId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Kategori Seçin</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isEnabled"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800 focus:ring-indigo-500"
                />
                <label htmlFor="isEnabled" className="text-xs font-semibold text-slate-300 cursor-pointer">
                  Kural Aktif Olsun
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingRule ? 'Güncelle' : 'Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Özel Profesyonel Onay Modalı */}
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
