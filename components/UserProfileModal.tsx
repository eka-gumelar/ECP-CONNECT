'use client';

import React, { useRef, useState } from 'react';
import { UserProfile, updateUserProfilePhoto, updateUserPassword } from '@/lib/auth';
import { processAvatarForProfile } from '@/lib/media';
import { 
  X, Camera, Trash2, Copy, Check, Lock, Clock, ShieldCheck, 
  RefreshCw, LogOut, CheckCircle2, Key, Eye, EyeOff, AlertCircle 
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  autoLockMinutes: number;
  onUpdateAutoLock: (minutes: number) => void;
  onLockNow: () => void;
  onSignOutCode: () => void;
  showToast: (msg: string) => void;
  onProfileUpdated?: (updated: UserProfile) => void;
}

export default function UserProfileModal({
  isOpen,
  onClose,
  profile,
  autoLockMinutes,
  onUpdateAutoLock,
  onLockNow,
  onSignOutCode,
  showToast,
  onProfileUpdated
}: UserProfileModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Change Password state (no previous password needed)
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(profile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Process & crop to lightweight 256x256 square avatar (< 30KB)
      const dataUrl = await processAvatarForProfile(file);
      await updateUserProfilePhoto(profile.id, dataUrl);
      if (onProfileUpdated) {
        onProfileUpdated({ ...profile, photoURL: dataUrl });
      }
      showToast('Foto profil berhasil diperbarui! 🎉');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Gagal mengunggah foto profil.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!profile.photoURL) return;
    if (!confirm('Hapus foto profil dan gunakan inisial warna bawaan?')) return;

    setUploading(true);
    try {
      await updateUserProfilePhoto(profile.id, '');
      if (onProfileUpdated) {
        onProfileUpdated({ ...profile, photoURL: '' });
      }
      showToast('Foto profil dihapus.');
    } catch (err: any) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const lockOptions = [
    { value: 1, label: '1 Menit' },
    { value: 3, label: '3 Menit' },
    { value: 5, label: '5 Menit (Standar)' },
    { value: 15, label: '15 Menit' },
    { value: 30, label: '30 Menit' },
    { value: -1, label: 'Nonaktif (Jangan kunci otomatis)' }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-xl border border-[#e1e4e8] max-w-sm w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#f0f2f5] border-b border-[#ddd] flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#1c1e21]">Profil Pengguna & Pengaturan</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#e1e4e8] rounded-full text-[#54656f] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Container (Scrollable) */}
        <div className="p-6 flex flex-col items-center text-center max-h-[80vh] overflow-y-auto">
          {/* Avatar with Camera Trigger */}
          <div className="relative mb-3 group shrink-0">
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/jpeg,image/png,image/webp,image/jpg,image/*" 
              onChange={handlePhotoSelect} 
              className="hidden" 
            />

            {profile.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={profile.photoURL} 
                alt={profile.name} 
                className="w-24 h-24 rounded-full object-cover shadow-md border-2 border-[#128c7e]"
              />
            ) : (
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-black shadow-md border-2 border-white"
                style={{ backgroundColor: profile.avatarColor || '#128c7e' }}
              >
                {profile.name.substring(0, 2).toUpperCase()}
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 p-2 bg-[#128c7e] hover:bg-[#0f7a6d] text-white rounded-full shadow-md transition-all active:scale-95 border-2 border-white cursor-pointer"
              title="Ganti Foto Profil (JPG/PNG)"
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Photo Actions */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-[#128c7e] hover:underline font-semibold cursor-pointer"
            >
              Ganti Foto Profil
            </button>
            {profile.photoURL && (
              <>
                <span className="text-slate-300">•</span>
                <button
                  onClick={handleRemovePhoto}
                  disabled={uploading}
                  className="text-xs text-red-600 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Hapus Foto</span>
                </button>
              </>
            )}
          </div>

          <h4 className="font-bold text-base text-[#1c1e21] leading-tight">{profile.name}</h4>
          
          {/* 6-Digit Code Badge */}
          <div className="mt-2 flex items-center gap-2 bg-[#f0f2f5] px-3 py-1.5 rounded-xl border border-[#e1e4e8]">
            <span className="text-[11px] text-[#667781] font-medium">Kode Unik:</span>
            <span className="font-mono font-black text-sm text-[#128c7e] tracking-wider">{profile.code}</span>
            <button 
              onClick={handleCopyCode}
              className="p-1 hover:text-[#128c7e] text-[#667781] transition-colors ml-1 cursor-pointer"
              title="Salin kode"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#25d366]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* ========================================== */}
          {/* FITUR GANTI KATA SANDI (TANPA SANDI LAMA) */}
          {/* ========================================== */}
          <div className="w-full mt-5 pt-4 border-t border-[#f0f2f5] text-left">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#1c1e21] flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[#128c7e]" />
                <span>Kata Sandi Akun</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(!showPasswordForm);
                  setPasswordError('');
                }}
                className="text-xs font-semibold text-[#128c7e] hover:underline cursor-pointer"
              >
                {showPasswordForm ? 'Tutup' : profile.passwordHash ? 'Ganti Sandi' : '+ Pasang Sandi'}
              </button>
            </div>

            <p className="text-[11px] text-[#667781] leading-relaxed">
              {profile.passwordHash 
                ? 'Akun Anda dilindungi kata sandi saat login & buka kunci layar.' 
                : 'Belum ada sandi (login hanya menggunakan 6-digit kode unik).'}
            </p>

            {showPasswordForm && (
              <div className="mt-3 p-3.5 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] text-left animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0f766e] mb-2.5 bg-[#ccfbf1] px-2 py-1 rounded-md">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Ganti kata sandi langsung tanpa memerlukan sandi lama</span>
                </div>

                {passwordError && (
                  <div className="mb-2.5 p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-[#475569] uppercase tracking-wider mb-1">
                      Kata Sandi Baru
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswordText ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimal 4 karakter..."
                        className="w-full bg-white border border-[#cbd5e1] focus:border-[#128c7e] rounded-lg px-3 py-1.5 text-xs text-[#1e293b] outline-none pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title={showPasswordText ? 'Sembunyikan' : 'Tampilkan'}
                      >
                        {showPasswordText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#475569] uppercase tracking-wider mb-1">
                      Konfirmasi Kata Sandi Baru
                    </label>
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ketik ulang kata sandi baru..."
                      className="w-full bg-white border border-[#cbd5e1] focus:border-[#128c7e] rounded-lg px-3 py-1.5 text-xs text-[#1e293b] outline-none"
                    />
                  </div>

                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={passwordUpdating || !newPassword.trim()}
                      onClick={async () => {
                        setPasswordError('');
                        if (!newPassword.trim()) {
                          setPasswordError('Masukkan kata sandi baru.');
                          return;
                        }
                        if (newPassword.trim().length < 4) {
                          setPasswordError('Kata sandi minimal 4 karakter.');
                          return;
                        }
                        if (newPassword !== confirmPassword) {
                          setPasswordError('Konfirmasi kata sandi tidak cocok.');
                          return;
                        }

                        setPasswordUpdating(true);
                        try {
                          const newHash = await updateUserPassword(profile.id, newPassword.trim());
                          if (onProfileUpdated) {
                            onProfileUpdated({ ...profile, passwordHash: newHash });
                          }
                          showToast('Kata sandi berhasil disimpan! 🔑');
                          setNewPassword('');
                          setConfirmPassword('');
                          setShowPasswordForm(false);
                        } catch (err: any) {
                          console.error(err);
                          setPasswordError(err.message || 'Gagal mengubah kata sandi');
                        } finally {
                          setPasswordUpdating(false);
                        }
                      }}
                      className="flex-1 py-1.5 px-3 bg-[#128c7e] hover:bg-[#0f7a6d] text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {passwordUpdating ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Simpan Sandi</span>
                    </button>

                    {profile.passwordHash && (
                      <button
                        type="button"
                        disabled={passwordUpdating}
                        onClick={async () => {
                          if (!confirm('Hapus kata sandi akun? Anda akan dapat masuk langsung hanya dengan kode 6-digit tanpa sandi.')) return;
                          setPasswordUpdating(true);
                          try {
                            await updateUserPassword(profile.id, '');
                            if (onProfileUpdated) {
                              onProfileUpdated({ ...profile, passwordHash: '' });
                            }
                            showToast('Kata sandi akun telah dihapus.');
                            setShowPasswordForm(false);
                            setNewPassword('');
                            setConfirmPassword('');
                          } catch (err: any) {
                            console.error(err);
                            setPasswordError('Gagal menghapus kata sandi.');
                          } finally {
                            setPasswordUpdating(false);
                          }
                        }}
                        className="py-1.5 px-2.5 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors cursor-pointer"
                        title="Hapus kata sandi akun"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Auto Lock Screen Settings */}
          <div className="w-full mt-4 pt-4 border-t border-[#f0f2f5] text-left">
            <label className="text-xs font-bold text-[#1c1e21] flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-[#128c7e]" />
              <span>Kunci Layar Otomatis (Auto-Lock)</span>
            </label>
            <p className="text-[11px] text-[#667781] mb-2 leading-relaxed">
              Otomatis mengunci layar obrolan saat tidak ada aktivitas mouse atau keyboard.
            </p>
            <select
              value={autoLockMinutes}
              onChange={(e) => onUpdateAutoLock(parseInt(e.target.value, 10))}
              className="w-full bg-[#f0f2f5] border border-[#d1d7db] rounded-xl px-3 py-2 text-xs text-[#1c1e21] font-medium outline-none focus:border-[#128c7e]"
            >
              {lockOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Bottom Actions */}
          <div className="w-full mt-5 flex flex-col gap-2 shrink-0">
            <button
              onClick={() => {
                onClose();
                onLockNow();
              }}
              className="w-full py-2.5 px-4 bg-[#f0f2f5] hover:bg-[#ffebee] hover:text-red-700 text-[#1c1e21] rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 border border-[#d1d7db] cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-red-600" />
              <span>Kunci Layar Sekarang</span>
            </button>

            <button
              onClick={() => {
                if (confirm('Keluar dari sesi kode ini? Anda perlu memasukkan kode 6-digit lagi untuk masuk.')) {
                  onClose();
                  onSignOutCode();
                }
              }}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-[#54656f] rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-[#e1e4e8] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ganti Akun Kode / Sign Out Kode</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
