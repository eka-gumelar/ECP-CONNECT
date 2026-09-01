'use client';

import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Ctrl + L / Alt + L', desc: 'Kunci Layar Aplikasi (App Lock instan)' },
    { key: 'Alt + D', desc: 'Buka / Tutup Direktori Akun & Grup' },
    { key: 'Alt + N', desc: 'Cari Kode / Obrolan Baru' },
    { key: 'Alt + G', desc: 'Buka Menu Buat Grup Baru' },
    { key: 'Ctrl + P', desc: 'Kirim PING (Panggilan Perhatian) ke chat aktif' },
    { key: 'Ctrl + F', desc: 'Buka Kolom Pencarian Pesan di chat aktif' },
    { key: '@ (di obrolan grup)', desc: 'Tampilkan daftar anggota untuk di-tag/mention' },
    { key: 'Esc', desc: 'Tutup pop-up / Batal balas / Kembali ke daftar obrolan' },
    { key: '?', desc: 'Buka dialog Pintasan Keyboard ini' },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-xl border border-[#e1e4e8] max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 bg-[#f0f2f5] border-b border-[#ddd] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#1c1e21]">
            <Keyboard className="w-5 h-5 text-[#128c7e]" />
            <h3 className="font-bold text-sm">Pintasan Keyboard (Shortcuts)</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#e1e4e8] rounded-full text-[#54656f] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto divide-y divide-[#f0f2f5]">
          {shortcuts.map((sc, idx) => (
            <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
              <span className="text-[#54656f]">{sc.desc}</span>
              <kbd className="px-2 py-1 bg-[#f0f2f5] border border-[#d1d7db] rounded-md font-mono text-[11px] font-semibold text-[#1c1e21] shadow-xs shrink-0 whitespace-nowrap">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="p-3 bg-[#f8f9fa] border-t border-[#eee] text-center text-[11px] text-[#667781]">
          Tekan <kbd className="px-1.5 py-0.5 bg-white border border-[#ddd] rounded text-[10px]">Esc</kbd> kapan saja untuk menutup dialog
        </div>
      </div>
    </div>
  );
}
