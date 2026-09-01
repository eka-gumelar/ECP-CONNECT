'use client';

import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { signInWithCode, signUp } from '@/lib/auth';
import { 
  UserPlus, LogIn, Key, CheckCircle, Copy, ArrowRight, 
  ShieldCheck, LogOut, AlertCircle, Lock
} from 'lucide-react';

export default function AuthScreen() {
  const { firebaseUser, signInGoogle, signOutGoogleAuth } = useAuth();

  const [authTab, setAuthTab] = useState<'code' | 'register'>('code');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [registeredCode, setRegisteredCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInGoogle();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal login dengan Google. Pastikan popup browser diizinkan.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (authTab === 'code') {
        if (!code.trim()) {
          throw new Error('Masukkan 6 digit kode unik Anda.');
        }
        await signInWithCode(code.trim().toUpperCase(), password);
      } else if (authTab === 'register') {
        if (!name.trim()) {
          throw new Error('Masukkan nama lengkap Anda.');
        }
        const result = await signUp(name.trim(), password);
        setRegisteredCode(result.code);
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal memproses autentikasi');
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (registeredCode) {
      navigator.clipboard.writeText(registeredCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLoginAfterRegister = async () => {
    if (registeredCode) {
      setLoading(true);
      try {
        await signInWithCode(registeredCode, password);
      } catch (err: any) {
        setError(err.message || 'Gagal masuk otomatis.');
        setRegisteredCode(null);
        setAuthTab('code');
        setCode(registeredCode);
      } finally {
        setLoading(false);
      }
    }
  };

  // 1. If not logged in with Google yet: Show Google Auth Gate
  if (!firebaseUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f2f5] p-4 font-sans text-[#1c1e21]">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#128c7e] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md text-white">
              <Key className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-black text-[#1c1e21] tracking-tight">ECP Connect</h1>
            <p className="text-xs text-[#54656f] mt-1.5 font-medium">
              Sistem Komunikasi Internal & Pesan Instan Perusahaan
            </p>
          </div>

          <div className="bg-white p-7 rounded-2xl shadow-sm border border-[#e1e4e8]">
            <h2 className="text-base font-bold text-[#1c1e21] mb-2 text-center">
              Langkah 1: Otorisasi Perangkat dengan Google
            </h2>
            <p className="text-xs text-[#54656f] text-center mb-6 leading-relaxed">
              Login dengan akun Google Anda untuk verifikasi identitas perangkat. Setelah login, Anda akan diminta memasukkan kode unik 6 digit Anda.
            </p>

            {error && (
              <div className="mb-5 p-3 bg-red-50 text-red-700 rounded-xl text-xs border border-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-full py-3 px-4 bg-white border border-[#dadce0] hover:bg-[#f8f9fa] text-[#3c4043] rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-3 shadow-xs hover:shadow-sm active:scale-[0.99]"
            >
              {googleLoading ? (
                <div className="w-5 h-5 border-2 border-[#128c7e]/30 border-t-[#128c7e] rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Lanjutkan dengan Google</span>
                </>
              )}
            </button>

            <div className="mt-6 pt-5 border-t border-[#f0f2f5] text-center">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#667781]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#128c7e]" />
                Enkripsi internal & autentikasi terlindungi
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Success Modal for Code Registration
  if (registeredCode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f2f5] p-4 font-sans text-[#1c1e21]">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-[#e1e4e8] max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#d9fdd3] text-[#128c7e] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-[#1c1e21] mb-1">Registrasi Berhasil!</h2>
          <p className="text-xs text-[#54656f] mb-5">
            Selamat datang, <span className="font-semibold text-[#1c1e21]">{name}</span>. Simpan dan catat kode 6-digit Anda berikut:
          </p>
          
          <div className="bg-[#f0f2f5] border-2 border-[#128c7e] rounded-xl p-5 mb-4 relative">
            <p className="text-[10px] text-[#128c7e] font-bold uppercase tracking-wider mb-1">Kode Unik 6-Digit Anda</p>
            <div className="text-4xl font-mono tracking-widest font-black text-[#128c7e] my-1">
              {registeredCode}
            </div>
            <button
              onClick={handleCopyCode}
              className="mt-3 px-3 py-1.5 bg-white border border-[#ddd] hover:border-[#128c7e] text-xs font-semibold text-[#1c1e21] rounded-lg transition-all inline-flex items-center gap-1.5 shadow-xs"
            >
              {copied ? <CheckCircle className="w-4 h-4 text-[#25d366]" /> : <Copy className="w-4 h-4 text-[#54656f]" />}
              <span>{copied ? 'Kode Berhasil Disalin!' : 'Salin Kode'}</span>
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-left mb-6">
            <p className="text-xs text-amber-900 font-bold flex items-center gap-1.5 mb-1">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>PENTING: Ingat Kode Ini!</span>
            </p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Tidak ada menu daftar kode publik di aplikasi. Setiap karyawan harus mengingat kode 6-digit miliknya sendiri untuk login kembali.
            </p>
          </div>

          <button 
            onClick={handleLoginAfterRegister}
            disabled={loading}
            className="w-full py-3 bg-[#128c7e] hover:bg-[#0f7a6d] text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <span>Masuk ke ECP Connect Sekarang</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 3. Step 2: Manual Login with 6-Digit Code (NO DIRECTORY)
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f2f5] p-4 font-sans text-[#1c1e21] relative overflow-hidden">
      {/* Tiny Google Verified status tucked in the corner */}
      <div className="fixed bottom-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1 bg-white/85 backdrop-blur-xs border border-[#dadce0] rounded-full shadow-xs text-[10px] text-[#54656f] hover:bg-white transition-all">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
        <span className="truncate max-w-[140px] text-[#3c4043] font-mono text-[9px]">{firebaseUser.email}</span>
        <span className="text-[#dadce0]">•</span>
        <button
          type="button"
          onClick={() => signOutGoogleAuth()}
          className="text-red-600 hover:text-red-700 hover:underline text-[9px] font-medium transition-colors"
          title="Keluar dari akun Google"
        >
          Keluar
        </button>
      </div>

      <div className="w-full max-w-md">
        {/* Manual Login Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e1e4e8]">
          <div className="text-center mb-5">
            <h1 className="text-2xl font-black text-[#1c1e21] tracking-tight">ECP Connect</h1>
            <p className="text-xs text-[#54656f] mt-1">
              Masukkan kode 6 digit Anda yang telah terdaftar
            </p>
          </div>

          {/* Navigation Tabs: Only 2 tabs: Manual Input & Buat Baru */}
          <div className="flex border-b border-[#f0f2f5] mb-5">
            <button
              type="button"
              onClick={() => { setAuthTab('code'); setError(''); }}
              className={`flex-1 pb-2.5 text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                authTab === 'code' ? 'text-[#128c7e] border-b-2 border-[#128c7e]' : 'text-[#667781] hover:text-[#1c1e21]'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Masuk dengan Kode</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthTab('register'); setError(''); }}
              className={`flex-1 pb-2.5 text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                authTab === 'register' ? 'text-[#128c7e] border-b-2 border-[#128c7e]' : 'text-[#667781] hover:text-[#1c1e21]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Buat Akun Baru</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-xs border border-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Tab 1: Manual Code Input */}
          {authTab === 'code' && (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#54656f] mb-1">
                  Kode Unik 6-Digit Anda
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="w-full px-3.5 py-3 bg-[#f0f2f5] rounded-xl border border-transparent focus:bg-white focus:border-[#128c7e] text-lg font-mono tracking-widest uppercase outline-none transition-all placeholder:normal-case placeholder:tracking-normal font-black text-center text-[#128c7e]"
                    placeholder="Contoh: TR441Q"
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-[#888] mt-1 text-center">
                  Setiap orang harus mengingat kodenya masing-masing
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#54656f] mb-1">
                  Kata Sandi / PIN (Opsional)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#f0f2f5] rounded-xl border border-transparent focus:bg-white focus:border-[#128c7e] text-sm outline-none transition-all"
                  placeholder="Kosongkan jika tidak memakai sandi"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-3 px-4 bg-[#128c7e] hover:bg-[#0f7a6d] text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Masuk ke ECP Connect</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Tab 2: Create New Profile (NO DIVISION/ROLE FIELD) */}
          {authTab === 'register' && (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#54656f] mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#f0f2f5] rounded-xl border border-transparent focus:bg-white focus:border-[#128c7e] text-sm outline-none transition-all"
                  placeholder="Contoh: Hendrawan Santoso"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#54656f] mb-1">
                  Kata Sandi / PIN Keamanan (Opsional)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#f0f2f5] rounded-xl border border-transparent focus:bg-white focus:border-[#128c7e] text-sm outline-none transition-all"
                  placeholder="Atur sandi jika ingin membatasi akses ke kode ini"
                />
                <p className="text-[10px] text-[#888] mt-1">
                  Sandi opsional untuk mencegah orang lain login dengan kode Anda
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-3 px-4 bg-[#128c7e] hover:bg-[#0f7a6d] text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Daftar & Buat Kode 6-Digit</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="mt-4 text-center">
          <p className="text-[11px] text-[#667781] flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#128c7e]" />
            <span>ECP Connect • Seluruh pesan & sesi terenkripsi aman</span>
          </p>
        </div>
      </div>
    </div>
  );
}
