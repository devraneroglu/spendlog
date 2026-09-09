'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/axios';
import { Tracker, TrackerItem, TrackerType } from '@/types/tracker';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import {
  CheckSquare,
  Plus,
  Trash2,
  Table as TableIcon,
  Loader2,
  Check,
  X,
  PlusCircle,
} from 'lucide-react';

export default function TrackersPage() {
  const toast = useToast();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [activeTrackerId, setActiveTrackerId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  // Modal State
  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState(false);
  const [trackerTitle, setTrackerTitle] = useState('');
  const [trackerDesc, setTrackerDesc] = useState('');
  const [columnNames, setColumnNames] = useState<string[]>(['Tarih', 'Açıklama', 'Tutar']);
  const [isSavingTracker, setIsSavingTracker] = useState(false);

  // New Row State
  const [isRowModalOpen, setIsRowModalOpen] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});
  const [isSavingRow, setIsSavingRow] = useState(false);

  const fetchTrackers = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<Tracker[]>('/api/trackers');
      setTrackers(res.data);
      if (res.data.length > 0 && activeTrackerId === null) {
        setActiveTrackerId(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch trackers', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackers();
  }, []);

  const activeTracker = trackers.find((t) => t.id === activeTrackerId);

  const activeColumns: string[] = activeTracker?.schemaDefinition
    ? JSON.parse(activeTracker.schemaDefinition)
    : ['Tarih', 'Açıklama', 'Tutar'];

  const handleSaveTracker = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTracker(true);
    try {
      await api.post('/api/trackers', {
        type: TrackerType.Custom,
        title: trackerTitle,
        description: trackerDesc,
        icon: 'table',
        color: '#6366f1',
        schemaDefinition: JSON.stringify(columnNames.filter((c) => c.trim().length > 0)),
      });
      setIsTrackerModalOpen(false);
      setTrackerTitle('');
      setTrackerDesc('');
      toast.success('Özel takipçi tablosu başarıyla oluşturuldu.');
      fetchTrackers();
    } catch (err: any) {
      console.error('Failed to create tracker', err);
      toast.error('Takipçi oluşturulurken hata oluştu: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSavingTracker(false);
    }
  };

  const handleSaveRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrackerId) return;

    setIsSavingRow(true);
    try {
      await api.post(`/api/trackers/${activeTrackerId}/items`, {
        trackerId: activeTrackerId,
        orderIndex: activeTracker?.items.length || 0,
        jsonData: JSON.stringify(newRowData),
      });
      setIsRowModalOpen(false);
      setNewRowData({});
      toast.success('Yeni kayıt başarıyla eklendi.');
      fetchTrackers();
    } catch (err: any) {
      console.error('Failed to add tracker item', err);
      toast.error('Kayıt eklenirken hata oluştu: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSavingRow(false);
    }
  };

  const handleDeleteTracker = (id: number, trackerName: string) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Takipçiyi Sil',
      message: `"${trackerName}" takipçi tablosunu ve içindeki tüm verileri silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      onConfirm: async () => {
        try {
          await api.delete(`/api/trackers/${id}`);
          toast.success(`"${trackerName}" takipçisi başarıyla silindi.`);
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          setActiveTrackerId(null);
          fetchTrackers();
        } catch (err: any) {
          console.error('Failed to delete tracker', err);
          toast.error('Takipçi silinirken hata oluştu: ' + (err.response?.data?.detail || err.message));
        }
      },
    });
  };

  return (
    <div>
      <Header
        title="Dinamik Takipçiler (Custom Trackers)"
        description="Özel tablolar ve sütun şemaları ile dilediğiniz veriyi anlık kaydedin ve yönetin"
        actions={
          <button
            onClick={() => setIsTrackerModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Takipçi Tablosu</span>
          </button>
        }
      />

      {/* Tracker Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {trackers.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTrackerId(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
              activeTrackerId === t.id
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>{t.title}</span>
            <span className="text-[10px] bg-slate-950/60 px-1.5 py-0.5 rounded-full text-slate-300">
              {t.items.length}
            </span>
          </button>
        ))}
      </div>

      {/* Active Tracker Table View */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : activeTracker ? (
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
            <div>
              <h3 className="font-bold text-sm text-white">{activeTracker.title}</h3>
              {activeTracker.description && (
                <p className="text-xs text-slate-400">{activeTracker.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setNewRowData({});
                  setIsRowModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Yeni Satır Ekle</span>
              </button>
              <button
                onClick={() => handleDeleteTracker(activeTracker.id, activeTracker.title)}
                className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg transition cursor-pointer"
                title="Tabloyu Sil"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="p-3.5 w-12 text-center">#</th>
                  {activeColumns.map((col, idx) => (
                    <th key={idx} className="p-3.5">
                      {col}
                    </th>
                  ))}
                  <th className="p-3.5 text-slate-500 text-right">Kayıt Tarihi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {activeTracker.items.length > 0 ? (
                  activeTracker.items.map((item, idx) => {
                    const rowData = JSON.parse(item.jsonData || '{}');
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3.5 text-center text-slate-500 font-mono">{idx + 1}</td>
                        {activeColumns.map((col, cIdx) => (
                          <td key={cIdx} className="p-3.5 text-slate-200">
                            {rowData[col] || '-'}
                          </td>
                        ))}
                        <td className="p-3.5 text-right text-slate-500 font-mono">
                          {new Date(item.createdAt).toLocaleDateString('tr-TR')}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={activeColumns.length + 2} className="text-center py-12 text-slate-500 text-xs">
                      Bu tabloda henüz kayıtlı satır verisi bulunmuyor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-sm">
          Henüz oluşturulmuş dinamik bir takipçi tablosu bulunmuyor.
        </div>
      )}

      {/* New Tracker Table Modal */}
      {isTrackerModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Yeni Dinamik Takipçi Tablosu</h2>
              <button
                onClick={() => setIsTrackerModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTracker} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Tablo Adı
                </label>
                <input
                  type="text"
                  value={trackerTitle}
                  onChange={(e) => setTrackerTitle(e.target.value)}
                  required
                  placeholder="Örn: Araç Yakıt Takibi, Fitness, Abonelikler"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Açıklama (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={trackerDesc}
                  onChange={(e) => setTrackerDesc(e.target.value)}
                  placeholder="Bu tablonun kullanım amacı..."
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Sütun Başlıkları (Virgülle Ayırın)
                </label>
                <input
                  type="text"
                  value={columnNames.join(', ')}
                  onChange={(e) => setColumnNames(e.target.value.split(',').map((s) => s.trim()))}
                  required
                  placeholder="Tarih, KM, Litre, Tutar, İstasyon"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Her virgül ayrı bir tablo sütunu oluşturur.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsTrackerModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSavingTracker}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 transition disabled:opacity-50"
                >
                  {isSavingTracker ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Tabloyu Oluştur</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Row Modal */}
      {isRowModalOpen && activeTracker && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">[{activeTracker.title}] Yeni Satır Ekle</h2>
              <button
                onClick={() => setIsRowModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRow} className="space-y-4">
              {activeColumns.map((col, idx) => (
                <div key={idx}>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    {col}
                  </label>
                  <input
                    type="text"
                    value={newRowData[col] || ''}
                    onChange={(e) => setNewRowData({ ...newRowData, [col]: e.target.value })}
                    required
                    placeholder={`${col} değeri...`}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRowModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSavingRow}
                  className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
                >
                  {isSavingRow ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Satırı Kaydet</span>
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
