'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Check, RotateCw, FlipHorizontal, Type, Sparkles, 
  Square, Circle, Move, ZoomIn, ZoomOut, Download, Send, Plus, Trash2, Image as ImageIcon
} from 'lucide-react';

interface StickerMakerModalProps {
  initialImage?: File | string | null;
  isOpen: boolean;
  onClose: () => void;
  onSendSticker: (stickerDataUrl: string, caption?: string) => void;
  onSaveToCollection: (stickerDataUrl: string) => void;
}

export default function StickerMakerModal({
  initialImage,
  isOpen,
  onClose,
  onSendSticker,
  onSaveToCollection
}: StickerMakerModalProps) {
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);
  const [cropShape, setCropShape] = useState<'square' | 'circle' | 'rounded'>('square');
  const [hasWhiteBorder, setHasWhiteBorder] = useState(true);
  const [stickerText, setStickerText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textPosition, setTextPosition] = useState<'bottom' | 'top' | 'center'>('bottom');
  const [rotation, setRotation] = useState(0); // in degrees: 0, 90, 180, 270
  const [flipped, setFlipped] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load image when initialImage changes or on modal open
  useEffect(() => {
    if (!isOpen) return;

    if (initialImage) {
      let isMounted = true;
      if (typeof initialImage === 'string') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (!isMounted) return;
          setSourceImg(img);
          setZoom(1);
          setPanOffset({ x: 0, y: 0 });
          setRotation(0);
          setFlipped(false);
        };
        img.src = initialImage;
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (!isMounted) return;
          const img = new Image();
          img.onload = () => {
            if (!isMounted) return;
            setSourceImg(img);
            setZoom(1);
            setPanOffset({ x: 0, y: 0 });
            setRotation(0);
            setFlipped(false);
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(initialImage);
      }
      return () => {
        isMounted = false;
      };
    }
  }, [initialImage, isOpen]);

  // Handle local image file picker
  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setSourceImg(img);
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
        setRotation(0);
        setFlipped(false);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Render sticker on canvas
  const renderStickerCanvas = useCallback((exportMode = false): HTMLCanvasElement | null => {
    const canvas = exportMode ? document.createElement('canvas') : canvasRef.current;
    if (!canvas) return null;

    const size = 512; // High-res 512x512 standard sticker format
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);

    if (!sourceImg) {
      // Draw placeholder
      ctx.fillStyle = '#f0f2f5';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#8696a0';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Pilih gambar untuk mulai membuat stiker', size / 2, size / 2);
      return canvas;
    }

    ctx.save();

    const padding = hasWhiteBorder ? 24 : 8;
    const contentSize = size - padding * 2;
    const center = size / 2;

    // Create clipping path based on selected crop shape
    ctx.beginPath();
    if (cropShape === 'circle') {
      ctx.arc(center, center, contentSize / 2, 0, Math.PI * 2);
    } else if (cropShape === 'rounded') {
      const radius = 48;
      const x = padding;
      const y = padding;
      const w = contentSize;
      const h = contentSize;
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + w, y, x + w, y + h, radius);
      ctx.arcTo(x + w, y + h, x, y + h, radius);
      ctx.arcTo(x, y + h, x, y, radius);
      ctx.arcTo(x, y, x + w, y, radius);
      ctx.closePath();
    } else {
      ctx.rect(padding, padding, contentSize, contentSize);
    }

    // Apply shadow & white sticker border if enabled
    if (hasWhiteBorder) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }

    // Clip to shape
    ctx.clip();

    // Fill background of the sticker shape with white (unless transparent)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(padding, padding, contentSize, contentSize);

    // Transform and draw the source image
    ctx.save();
    ctx.translate(center + panOffset.x, center + panOffset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    if (flipped) {
      ctx.scale(-1, 1);
    }
    ctx.scale(zoom, zoom);

    // Maintain aspect ratio cover
    const imgAspect = sourceImg.width / sourceImg.height;
    let drawW = contentSize;
    let drawH = contentSize;

    if (imgAspect > 1) {
      drawW = contentSize * imgAspect;
    } else {
      drawH = contentSize / imgAspect;
    }

    ctx.drawImage(sourceImg, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Draw sticker border stroke
    if (hasWhiteBorder) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 14;
      ctx.stroke();
    }

    // Draw text overlay if provided
    if (stickerText.trim()) {
      ctx.restore(); // Exit clipping
      ctx.save();

      const text = stickerText.trim().toUpperCase();
      ctx.font = '900 36px "Impact", "Arial Black", sans-serif';
      ctx.textAlign = 'center';

      let textY = size - 45;
      if (textPosition === 'top') textY = 65;
      if (textPosition === 'center') textY = size / 2 + 12;

      // Text black thick stroke outline (meme style)
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 8;
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 2;
      ctx.strokeText(text, size / 2, textY);

      // Text main fill
      ctx.fillStyle = textColor;
      ctx.fillText(text, size / 2, textY);

      ctx.restore();
    } else {
      ctx.restore();
    }

    return canvas;
  }, [sourceImg, cropShape, hasWhiteBorder, stickerText, textColor, textPosition, rotation, flipped, zoom, panOffset]);

  // Update canvas preview whenever parameters change
  useEffect(() => {
    renderStickerCanvas(false);
  }, [renderStickerCanvas]);

  // Mouse pan handlers on preview canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Finish and export as PNG dataURL
  const exportSticker = (): string | null => {
    const canvas = renderStickerCanvas(true);
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  };

  const handleSend = () => {
    const dataUrl = exportSticker();
    if (!dataUrl) return;
    onSaveToCollection(dataUrl);
    onSendSticker(dataUrl, stickerText.trim() || undefined);
    onClose();
  };

  const handleSaveOnly = () => {
    const dataUrl = exportSticker();
    if (!dataUrl) return;
    onSaveToCollection(dataUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-150 select-none">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-[#e1e4e8] flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#f0f2f5] border-b border-[#ddd] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#128c7e] text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1c1e21]">Pembuat Stiker & Editor</h3>
              <p className="text-[11px] text-[#667781]">Ubah gambar/foto menjadi stiker PNG kustom</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#54656f] hover:text-[#1c1e21] hover:bg-[#e1e4e8] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col md:flex-row gap-6 items-center">
          
          {/* Canvas Preview Area */}
          <div className="flex flex-col items-center gap-3">
            <div 
              className="relative w-[280px] h-[280px] md:w-[320px] md:h-[320px] rounded-2xl border-2 border-dashed border-[#128c7e]/40 bg-[#f7f9fa] flex items-center justify-center overflow-hidden shadow-inner cursor-grab active:cursor-grabbing"
              title="Seret untuk menggeser posisi gambar"
            >
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="w-full h-full object-contain"
              />

              {!sourceImg && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#128c7e] hover:bg-[#128c7e]/5 transition-colors p-4 text-center"
                >
                  <ImageIcon className="w-10 h-10 text-[#128c7e]/60" />
                  <span className="text-xs font-bold">Klik untuk Pilih Gambar</span>
                  <span className="text-[10px] text-[#667781]">Mendukung PNG, JPG, JPEG, WebP</span>
                </button>
              )}
            </div>

            {/* Quick Canvas Controls */}
            {sourceImg && (
              <div className="flex items-center gap-1.5 bg-[#f0f2f5] p-1.5 rounded-xl border border-[#e1e4e8] text-xs">
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(0.5, prev - 0.15))}
                  className="p-1.5 hover:bg-white rounded-lg text-[#54656f] transition-colors"
                  title="Perkecil Zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono font-bold px-1 text-[#1c1e21]">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(3, prev + 0.15))}
                  className="p-1.5 hover:bg-white rounded-lg text-[#54656f] transition-colors"
                  title="Perbesar Zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <div className="w-[1px] h-4 bg-[#ddd] mx-0.5" />
                <button
                  type="button"
                  onClick={() => setRotation(prev => (prev + 90) % 360)}
                  className="p-1.5 hover:bg-white rounded-lg text-[#54656f] transition-colors"
                  title="Putar 90 Derajat"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setFlipped(prev => !prev)}
                  className={`p-1.5 rounded-lg transition-colors ${flipped ? 'bg-[#128c7e] text-white' : 'hover:bg-white text-[#54656f]'}`}
                  title="Cerminkan Horisontal"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
                <div className="w-[1px] h-4 bg-[#ddd] mx-0.5" />
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPanOffset({ x: 0, y: 0 });
                    setRotation(0);
                    setFlipped(false);
                  }}
                  className="px-2 py-1 hover:bg-white rounded-lg text-[10px] text-[#54656f] font-semibold transition-colors"
                  title="Reset Posisi"
                >
                  Reset
                </button>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleSelectFile}
              className="hidden"
            />
          </div>

          {/* Settings & Tools Column */}
          <div className="flex-1 w-full flex flex-col gap-4 text-xs">
            
            {/* Shape selection */}
            <div>
              <label className="font-bold text-[#1c1e21] block mb-1.5 text-[11px] uppercase tracking-wider">
                1. Bentuk Potongan Stiker
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCropShape('square')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                    cropShape === 'square'
                      ? 'border-[#128c7e] bg-[#e7f8e8] text-[#128c7e] font-bold shadow-xs'
                      : 'border-[#e1e4e8] bg-white text-[#54656f] hover:bg-[#f0f2f5]'
                  }`}
                >
                  <Square className="w-4 h-4" />
                  <span className="text-[11px]">Persegi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCropShape('rounded')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                    cropShape === 'rounded'
                      ? 'border-[#128c7e] bg-[#e7f8e8] text-[#128c7e] font-bold shadow-xs'
                      : 'border-[#e1e4e8] bg-white text-[#54656f] hover:bg-[#f0f2f5]'
                  }`}
                >
                  <div className="w-4 h-4 rounded-md border-2 border-current" />
                  <span className="text-[11px]">Sudut Melengkung</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCropShape('circle')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                    cropShape === 'circle'
                      ? 'border-[#128c7e] bg-[#e7f8e8] text-[#128c7e] font-bold shadow-xs'
                      : 'border-[#e1e4e8] bg-white text-[#54656f] hover:bg-[#f0f2f5]'
                  }`}
                >
                  <Circle className="w-4 h-4" />
                  <span className="text-[11px]">Lingkaran</span>
                </button>
              </div>
            </div>

            {/* Sticker White Border Outline Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#f0f2f5] rounded-xl border border-[#e1e4e8]">
              <div>
                <p className="font-bold text-[#1c1e21] text-xs">Garis Tepi Putih (Sticker Outline)</p>
                <p className="text-[10px] text-[#667781]">Menambahkan garis putih khas stiker WhatsApp</p>
              </div>
              <button
                type="button"
                onClick={() => setHasWhiteBorder(!hasWhiteBorder)}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                  hasWhiteBorder ? 'bg-[#128c7e]' : 'bg-[#ccc]'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  hasWhiteBorder ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Sticker Meme Text Overlay */}
            <div>
              <label className="font-bold text-[#1c1e21] block mb-1.5 text-[11px] uppercase tracking-wider flex items-center justify-between">
                <span>2. Teks / Tulisan Stiker (Opsional)</span>
                <span className="text-[10px] text-[#667781] font-normal font-sans">Gaya Meme</span>
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={stickerText}
                  onChange={(e) => setStickerText(e.target.value)}
                  placeholder="Contoh: SIAP KOMANDAN, OTW, ACC..."
                  maxLength={24}
                  className="w-full px-3 py-2 bg-white border border-[#e1e4e8] rounded-xl outline-none focus:border-[#128c7e] text-xs font-bold text-[#1c1e21]"
                />

                {stickerText && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-[#667781]">Posisi:</span>
                      {(['top', 'center', 'bottom'] as const).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => setTextPosition(pos)}
                          className={`px-2 py-0.5 rounded text-[10px] capitalize font-medium ${
                            textPosition === pos ? 'bg-[#128c7e] text-white' : 'bg-[#f0f2f5] text-[#54656f]'
                          }`}
                        >
                          {pos === 'top' ? 'Atas' : pos === 'center' ? 'Tengah' : 'Bawah'}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#667781]">Warna:</span>
                      {['#ffffff', '#ffeb3b', '#00e676', '#ff5252', '#00e5ff'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setTextColor(c)}
                          className={`w-5 h-5 rounded-full border-2 transition-transform ${
                            textColor === c ? 'scale-110 border-[#1c1e21]' : 'border-white shadow-xs'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Change source image button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 px-3 border border-[#128c7e] text-[#128c7e] hover:bg-[#128c7e]/5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Ganti Gambar Sumber</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3.5 bg-[#f0f2f5] border-t border-[#ddd] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#54656f] hover:text-[#1c1e21] hover:bg-[#e1e4e8] rounded-xl transition-colors cursor-pointer"
          >
            Batal
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveOnly}
              disabled={!sourceImg}
              className="px-4 py-2 bg-white hover:bg-gray-50 border border-[#e1e4e8] text-[#1c1e21] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              title="Simpan ke koleksi Stiker Saya untuk digunakan kapan saja"
            >
              <Plus className="w-3.5 h-3.5 text-[#128c7e]" />
              <span>Simpan ke Stiker Saya</span>
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={!sourceImg}
              className="px-5 py-2 bg-[#128c7e] hover:bg-[#0f7a6d] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm cursor-pointer active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim Stiker</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
