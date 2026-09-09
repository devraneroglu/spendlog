'use client';

import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title = 'Onay Gerekiyor',
  message,
  confirmText = 'Evet, Onayla',
  cancelText = 'Vazgeç',
  isDestructive = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isDestructive ? 'bg-red-500/10 text-red-400' : 'bg-indigo-500/10 text-indigo-400'
            }`}
          >
            {isDestructive ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{message}</p>
          </div>

          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700/80 rounded-xl transition cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-lg transition cursor-pointer ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
