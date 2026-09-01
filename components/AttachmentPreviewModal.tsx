'use client';

import React, { useState } from 'react';
import { 
  X, Send, FileText, Image as ImageIcon, Sparkles
} from 'lucide-react';

export interface PendingAttachmentData {
  file: File;
  previewUrl: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  isImage: boolean;
  caption: string;
}

interface AttachmentPreviewModalProps {
  attachment: PendingAttachmentData | null;
  isOpen: boolean;
  onClose: () => void;
  onSend: (attachment: PendingAttachmentData) => void;
  onOpenStickerMaker?: (file: File) => void;
}

function AttachmentPreviewContent({
  attachment,
  onClose,
  onSend,
  onOpenStickerMaker
}: {
  attachment: PendingAttachmentData;
  onClose: () => void;
  onSend: (attachment: PendingAttachmentData) => void;
  onOpenStickerMaker?: (file: File) => void;
}) {
  const [caption, setCaption] = useState(attachment.caption || '');
  const [customFileName] = useState(attachment.fileName || '');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSend({
      ...attachment,
      fileName: customFileName.trim() || attachment.fileName,
      caption: caption.trim()
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-[#111b21] text-[#e9edef] w-full max-w-xl rounded-2xl shadow-2xl border border-[#2a3942] flex flex-col max-h-[92vh] overflow-hidden">
      {/* Top Header */}
      <div className="px-4 py-3 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between">
        <div className="flex items-center gap-2">
          {attachment.isImage ? (
            <ImageIcon className="w-4 h-4 text-[#00a884]" />
          ) : (
            <FileText className="w-4 h-4 text-[#00a884]" />
          )}
          <span className="text-xs font-bold truncate max-w-[280px]">
            {attachment.isImage ? 'Kirim Foto / Gambar' : 'Kirim Lampiran Dokumen'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Sticker Maker Shortcut if Image */}
          {attachment.isImage && onOpenStickerMaker && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenStickerMaker(attachment.file);
              }}
              className="px-2.5 py-1 bg-[#00a884]/15 hover:bg-[#00a884]/25 text-[#00a884] rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Buka di Editor Stiker"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Jadikan Stiker</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] rounded-full transition-colors cursor-pointer"
            title="Batal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Media Preview Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center bg-[#0c1317] min-h-[220px] max-h-[460px]">
        {attachment.isImage ? (
          <div className="relative max-h-[380px] max-w-full flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.previewUrl}
              alt={attachment.fileName}
              className="max-h-[360px] max-w-full rounded-xl object-contain shadow-lg border border-[#2a3942]"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 bg-[#202c33] rounded-2xl border border-[#2a3942] max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#00a884]/20 text-[#00a884] flex items-center justify-center mb-3">
              <FileText className="w-8 h-8" />
            </div>
            <p className="text-sm font-bold text-[#e9edef] truncate max-w-[280px] mb-1">
              {attachment.fileName}
            </p>
            <div className="flex items-center gap-2 text-xs text-[#8696a0]">
              <span>{attachment.fileSize}</span>
              <span>•</span>
              <span className="uppercase">{attachment.fileType.split('/')[1] || 'File'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Caption & Input Footer */}
      <form onSubmit={handleSubmit} className="p-3.5 bg-[#202c33] border-t border-[#2a3942] flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tambah keterangan / caption (opsional)... Tekan Enter untuk kirim"
            className="flex-1 bg-[#111b21] border border-[#2a3942] focus:border-[#00a884] rounded-xl px-4 py-2.5 text-xs text-[#e9edef] outline-none placeholder:text-[#8696a0]"
            autoFocus
          />

          <button
            type="submit"
            className="px-4 py-2.5 bg-[#00a884] hover:bg-[#008f6f] text-[#111b21] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
            title="Kirim Pesan"
          >
            <Send className="w-4 h-4 ml-0.5" />
            <span>Kirim</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#8696a0] px-1">
          <span className="truncate max-w-[320px]">
            Berkas: {attachment.fileName} ({attachment.fileSize})
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8696a0] hover:text-red-400 font-medium cursor-pointer"
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AttachmentPreviewModal({
  attachment,
  isOpen,
  onClose,
  onSend,
  onOpenStickerMaker
}: AttachmentPreviewModalProps) {
  if (!isOpen || !attachment) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-150 select-none">
      <AttachmentPreviewContent
        key={attachment.previewUrl || attachment.fileName}
        attachment={attachment}
        onClose={onClose}
        onSend={onSend}
        onOpenStickerMaker={onOpenStickerMaker}
      />
    </div>
  );
}
