'use client';

import React, { useState, useMemo } from 'react';
import { 
  Smile, Sparkles, Image as ImageIcon, Plus, Search, 
  Trash2, X, Heart, ThumbsUp, Zap, Briefcase
} from 'lucide-react';

export interface StickerItem {
  id: string;
  url: string;
  name: string;
  category?: string;
  isCustom?: boolean;
}

// Curated Built-in WhatsApp/ECP Style Stickers (High-quality SVG/PNG Data URIs)
const BUILT_IN_STICKERS: StickerItem[] = [
  // ECP & Office Work Badges
  {
    id: 's_acc',
    name: 'ACC / Approved',
    category: 'office',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect x="10" y="10" width="140" height="140" rx="30" fill="%2300a884" stroke="%23ffffff" stroke-width="8"/><circle cx="80" cy="80" r="50" fill="%23ffffff"/><path d="M55 80 L72 97 L105 62" fill="none" stroke="%2300a884" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><text x="80" y="145" fill="%23ffffff" font-family="sans-serif" font-weight="900" font-size="16" text-anchor="middle">APPROVED</text></svg>'
  },
  {
    id: 's_siap',
    name: 'Siap Komandan',
    category: 'office',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect x="10" y="10" width="140" height="140" rx="30" fill="%23128c7e" stroke="%23ffffff" stroke-width="8"/><circle cx="80" cy="65" r="35" fill="%23ffd54f"/><circle cx="68" cy="60" r="5" fill="%23333"/><circle cx="92" cy="60" r="5" fill="%23333"/><path d="M68 78 Q80 90 92 78" fill="none" stroke="%23333" stroke-width="4" stroke-linecap="round"/><path d="M100 45 L125 35 L115 65 Z" fill="%23ffd54f" stroke="%23333" stroke-width="3"/><text x="80" y="135" fill="%23ffffff" font-family="sans-serif" font-weight="900" font-size="14" text-anchor="middle">SIAP GERAK!</text></svg>'
  },
  {
    id: 's_mantap',
    name: 'Mantap / Good Job',
    category: 'office',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect x="10" y="10" width="140" height="140" rx="30" fill="%233b82f6" stroke="%23ffffff" stroke-width="8"/><text x="80" y="85" font-size="52" text-anchor="middle">👍</text><text x="80" y="132" fill="%23ffffff" font-family="sans-serif" font-weight="900" font-size="15" text-anchor="middle">MANTAP JOSS!</text></svg>'
  },
  {
    id: 's_ngopi',
    name: 'Ngopi Dulu',
    category: 'office',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect x="10" y="10" width="140" height="140" rx="30" fill="%23795548" stroke="%23ffffff" stroke-width="8"/><text x="80" y="82" font-size="50" text-anchor="middle">☕</text><text x="80" y="132" fill="%23ffffff" font-family="sans-serif" font-weight="900" font-size="14" text-anchor="middle">NGOPI DULU</text></svg>'
  },
  {
    id: 's_otw',
    name: 'OTW / Di Jalan',
    category: 'office',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect x="10" y="10" width="140" height="140" rx="30" fill="%23ff9800" stroke="%23ffffff" stroke-width="8"/><text x="80" y="82" font-size="50" text-anchor="middle">🛵</text><text x="80" y="132" fill="%23ffffff" font-family="sans-serif" font-weight="900" font-size="16" text-anchor="middle">OTW LOKASI!</text></svg>'
  },
  {
    id: 's_noted',
    name: 'Noted / Siap Dicatat',
    category: 'office',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect x="10" y="10" width="140" height="140" rx="30" fill="%238b5cf6" stroke="%23ffffff" stroke-width="8"/><text x="80" y="82" font-size="50" text-anchor="middle">📝</text><text x="80" y="132" fill="%23ffffff" font-family="sans-serif" font-weight="900" font-size="16" text-anchor="middle">NOTED BOSS</text></svg>'
  },
  {
    id: 's_urgent',
    name: 'Urgent / Penting',
    category: 'office',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect x="10" y="10" width="140" height="140" rx="30" fill="%23ef4444" stroke="%23ffffff" stroke-width="8"/><text x="80" y="82" font-size="50" text-anchor="middle">🚨</text><text x="80" y="132" fill="%23ffffff" font-family="sans-serif" font-weight="900" font-size="16" text-anchor="middle">URGENT CALL</text></svg>'
  },
  {
    id: 's_terimakasih',
    name: 'Terima Kasih',
    category: 'office',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect x="10" y="10" width="140" height="140" rx="30" fill="%2306b6d4" stroke="%23ffffff" stroke-width="8"/><text x="80" y="82" font-size="50" text-anchor="middle">🙏</text><text x="80" y="132" fill="%23ffffff" font-family="sans-serif" font-weight="900" font-size="14" text-anchor="middle">TERIMA KASIH</text></svg>'
  },

  // Expressions & Memes
  {
    id: 's_fire',
    name: 'Menyala Abangku',
    category: 'meme',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect x="10" y="10" width="140" height="140" rx="30" fill="%23f97316" stroke="%23ffffff" stroke-width="8"/><text x="80" y="82" font-size="50" text-anchor="middle">🔥</text><text x="80" y="132" fill="%23ffffff" font-family="sans-serif" font-weight="900" font-size="13" text-anchor="middle">MENYALA ABANGKU</text></svg>'
  },
  {
    id: 's_party',
    name: 'Cair / Gajian',
    category: 'meme',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect x="10" y="10" width="140" height="140" rx="30" fill="%2310b981" stroke="%23ffffff" stroke-width="8"/><text x="80" y="82" font-size="50" text-anchor="middle">🎉</text><text x="80" y="132" fill="%23ffffff" font-family="sans-serif" font-weight="900" font-size="15" text-anchor="middle">CAIRR BOSSKU</text></svg>'
  },
  {
    id: 's_gas',
    name: 'Gaspol',
    category: 'meme',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect x="10" y="10" width="140" height="140" rx="30" fill="%23e11d48" stroke="%23ffffff" stroke-width="8"/><text x="80" y="82" font-size="50" text-anchor="middle">🚀</text><text x="80" y="132" fill="%23ffffff" font-family="sans-serif" font-weight="900" font-size="16" text-anchor="middle">GASPOL REM BLONG</text></svg>'
  },
  {
    id: 's_santai',
    name: 'Santai Dulu',
    category: 'meme',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect x="10" y="10" width="140" height="140" rx="30" fill="%236366f1" stroke="%23ffffff" stroke-width="8"/><text x="80" y="82" font-size="50" text-anchor="middle">😎</text><text x="80" y="132" fill="%23ffffff" font-family="sans-serif" font-weight="900" font-size="15" text-anchor="middle">SANTAI DULU</text></svg>'
  }
];

// Rich Emojis list categorized
const EMOJI_CATEGORIES = [
  {
    name: 'Sering Dipakai',
    emojis: ['😀', '😂', '🤣', '😍', '🥰', '😊', '😎', '👍', '🙏', '❤️', '🔥', '🎉', '💯', '✨', '👏', '🤝', '☕', '🚀', '✅', '⭐']
  },
  {
    name: 'Wajah & Emosi',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘',
      '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑',
      '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
      '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯',
      '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩',
      '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👻', '👽', '👾', '🤖'
    ]
  },
  {
    name: 'Tangan & Gestur',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆',
      '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️',
      '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀'
    ]
  },
  {
    name: 'Kantor, Kerja & Simbol',
    emojis: [
      '💼', '📁', '📂', '📄', '📃', '📋', '📊', '📈', '📉', '📑', '📅', '📆', '🗓️', '📇', '🗃️', '🗳️',
      '🗄️', '📌', '📍', '📎', '🖇️', '📏', '📐', '✂️', '🖊️', '🖋️', '✒️', '📝', '✏️', '🔍', '🔎', '🔒',
      '🔓', '🔏', '🔐', '🔑', '🗝️', '🔨', '🛠️', '⚙️', '🧱', '⛓️', '💡', '🔦', '⏰', '⏱️', '⏲️', '⏳',
      '📢', '📣', '🔔', '🔕', '💬', '💭', '🗯️', '✔️', '✅', '❌', '⭕', '❗', '❓', '⚠️', '⛔', '🚫'
    ]
  },
  {
    name: 'Aktivitas & Makanan',
    emojis: [
      '☕', '🍵', '🧃', '🥤', '🍺', '🍻', '🥂', '🍾', '🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🍜',
      '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🍧', '🍨', '🍦', '🥧', '🍰',
      '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🛵', '🏍️'
    ]
  }
];

interface EmojiStickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (stickerUrl: string) => void;
  onOpenStickerMaker: () => void;
  customStickers?: StickerItem[];
  onDeleteCustomSticker?: (id: string) => void;
}

export default function EmojiStickerPicker({
  isOpen,
  onClose,
  onSelectEmoji,
  onSelectSticker,
  onOpenStickerMaker,
  customStickers = [],
  onDeleteCustomSticker
}: EmojiStickerPickerProps) {
  const [activeTab, setActiveTab] = useState<'emoji' | 'stickers' | 'custom'>('emoji');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered emojis
  const filteredEmojiCategories = useMemo(() => {
    if (!searchQuery.trim()) return EMOJI_CATEGORIES;
    const q = searchQuery.toLowerCase();
    return EMOJI_CATEGORIES.map(cat => ({
      name: cat.name,
      emojis: cat.emojis.filter(e => e.includes(q))
    })).filter(cat => cat.emojis.length > 0);
  }, [searchQuery]);

  // Filtered built-in stickers
  const filteredStickers = useMemo(() => {
    if (!searchQuery.trim()) return BUILT_IN_STICKERS;
    const q = searchQuery.toLowerCase();
    return BUILT_IN_STICKERS.filter(s => 
      s.name.toLowerCase().includes(q) || (s.category && s.category.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div 
      className="absolute bottom-16 left-3 md:left-6 z-40 bg-white border border-[#e1e4e8] rounded-2xl shadow-2xl w-[320px] sm:w-[360px] md:w-[400px] h-[360px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-3 duration-150 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Tab Bar */}
      <div className="bg-[#f0f2f5] border-b border-[#ddd] p-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1 bg-white/70 p-1 rounded-xl border border-[#e1e4e8]">
          <button
            type="button"
            onClick={() => setActiveTab('emoji')}
            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'emoji' ? 'bg-[#128c7e] text-white shadow-xs' : 'text-[#54656f] hover:bg-black/5'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>Emoji</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stickers')}
            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'stickers' ? 'bg-[#128c7e] text-white shadow-xs' : 'text-[#54656f] hover:bg-black/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Stiker ECP</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'custom' ? 'bg-[#128c7e] text-white shadow-xs' : 'text-[#54656f] hover:bg-black/5'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Stiker Saya</span>
            {customStickers.length > 0 && (
              <span className="text-[10px] bg-black/10 px-1.5 py-0.2 rounded-full font-mono">
                {customStickers.length}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 text-[#54656f] hover:text-[#1c1e21] hover:bg-[#e1e4e8] rounded-full transition-colors"
          title="Tutup"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-2 border-b border-[#f0f2f5] bg-white">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#8696a0] absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'emoji' ? "Cari emoji..." : "Cari nama stiker..."
            }
            className="w-full pl-8 pr-3 py-1.5 bg-[#f0f2f5] rounded-xl text-xs text-[#1c1e21] outline-none border border-transparent focus:border-[#128c7e]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-[#8696a0] hover:text-[#333]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'emoji' && (
          <div className="space-y-4">
            {filteredEmojiCategories.map((cat, idx) => (
              <div key={idx}>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#667781] mb-1.5 px-1">
                  {cat.name}
                </h4>
                <div className="grid grid-cols-8 gap-1">
                  {cat.emojis.map((emoji, eIdx) => (
                    <button
                      key={eIdx}
                      type="button"
                      onClick={() => onSelectEmoji(emoji)}
                      className="w-9 h-9 flex items-center justify-center text-xl hover:bg-[#f0f2f5] hover:scale-125 rounded-lg transition-transform cursor-pointer"
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'stickers' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#667781]">
                Koleksi Stiker Kantor & Meme
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenStickerMaker();
                }}
                className="text-[11px] text-[#128c7e] hover:underline font-bold flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Buat Sendiri</span>
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {filteredStickers.map((sticker) => (
                <div
                  key={sticker.id}
                  onClick={() => {
                    onSelectSticker(sticker.url);
                    onClose();
                  }}
                  className="group relative flex flex-col items-center p-2 rounded-xl border border-transparent hover:border-[#128c7e] hover:bg-[#e7f8e8]/50 transition-all cursor-pointer"
                  title={sticker.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sticker.url}
                    alt={sticker.name}
                    className="w-18 h-18 object-contain group-hover:scale-105 transition-transform drop-shadow-xs"
                    loading="lazy"
                  />
                  <span className="text-[10px] font-medium text-[#54656f] group-hover:text-[#128c7e] truncate w-full text-center mt-1">
                    {sticker.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'custom' && (
          <div className="space-y-3">
            {/* Create Custom Sticker Banner */}
            <div 
              onClick={() => {
                onClose();
                onOpenStickerMaker();
              }}
              className="p-3 bg-gradient-to-r from-[#128c7e]/10 to-[#00a884]/20 border border-[#128c7e]/30 rounded-xl flex items-center justify-between cursor-pointer hover:bg-[#128c7e]/15 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#128c7e] text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1c1e21]">Buat Stiker dari Gambar</h4>
                  <p className="text-[10px] text-[#667781]">Potong, beri outline putih & teks meme</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-[#128c7e] text-white rounded-lg text-xs font-bold group-hover:bg-[#0f7a6d]">
                + Buat
              </span>
            </div>

            {customStickers.length === 0 ? (
              <div className="p-8 text-center text-[#8696a0] flex flex-col items-center">
                <ImageIcon className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-xs font-semibold">Belum Ada Stiker Kustom</p>
                <p className="text-[11px] text-[#999] mt-0.5 max-w-xs">
                  Klik tombol &quot;+ Buat&quot; di atas untuk membuat stiker unik dari foto atau screenshot Anda.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {customStickers.map((sticker) => (
                  <div
                    key={sticker.id}
                    onClick={() => {
                      onSelectSticker(sticker.url);
                      onClose();
                    }}
                    className="group relative flex flex-col items-center p-2 rounded-xl border border-transparent hover:border-[#128c7e] hover:bg-[#e7f8e8]/50 transition-all cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sticker.url}
                      alt={sticker.name || 'Stiker Kustom'}
                      className="w-18 h-18 object-contain group-hover:scale-105 transition-transform drop-shadow-xs"
                      loading="lazy"
                    />

                    {onDeleteCustomSticker && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCustomSticker(sticker.id);
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Hapus Stiker"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="p-2 bg-[#f0f2f5] border-t border-[#ddd] flex items-center justify-between text-[10px] text-[#667781] px-3">
        <span>Klik untuk langsung mengirim</span>
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenStickerMaker();
          }}
          className="text-[#128c7e] font-bold hover:underline"
        >
          Editor Stiker
        </button>
      </div>
    </div>
  );
}
