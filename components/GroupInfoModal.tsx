'use client';

import React, { useState } from 'react';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/lib/auth';
import { 
  doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, 
  addDoc, collection, query, where, getDocs 
} from 'firebase/firestore';
import { 
  X, Users, Crown, Shield, User, UserPlus, UserMinus, 
  Check, AlertCircle, LogOut, Clock, MessageSquare 
} from 'lucide-react';

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeChat: any;
  user: UserProfile;
  profile: UserProfile;
  showToast: (msg: string) => void;
  onLeaveGroup?: () => void;
  usersMap?: Record<string, UserProfile>;
}

export default function GroupInfoModal({
  isOpen,
  onClose,
  activeChat,
  user,
  profile,
  showToast,
  onLeaveGroup,
  usersMap
}: GroupInfoModalProps) {
  const [addCode, setAddCode] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  if (!isOpen || !activeChat || activeChat.type !== 'group') return null;

  const isCreator = activeChat.creatorId === user.id;
  const isAdmin = isCreator || activeChat.admins?.includes(user.id);
  const joinRequests: any[] = activeChat.joinRequests || [];

  // Approve a join request
  const handleApproveRequest = async (req: any) => {
    try {
      const chatRef = doc(db, 'chats', activeChat.id);
      await updateDoc(chatRef, {
        participants: arrayUnion(req.userId),
        participantCodes: arrayUnion(req.userCode),
        [`participantNames.${req.userId}`]: req.userName,
        joinRequests: arrayRemove(req),
        lastMessage: `${req.userName} bergabung ke grup`,
        lastMessageTime: serverTimestamp()
      });

      // Send system message
      await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
        type: 'system',
        text: `${req.userName} telah disetujui bergabung ke grup.`,
        timestamp: serverTimestamp()
      });

      showToast(`Permintaan ${req.userName} diterima!`);
    } catch (err: any) {
      console.error(err);
      showToast('Gagal menyetujui permintaan.');
    }
  };

  // Reject a join request
  const handleRejectRequest = async (req: any) => {
    try {
      const chatRef = doc(db, 'chats', activeChat.id);
      await updateDoc(chatRef, {
        joinRequests: arrayRemove(req)
      });
      showToast('Permintaan ditolak.');
    } catch (err: any) {
      console.error(err);
    }
  };

  // Add member by 6-digit code
  const handleAddMemberByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = addCode.trim().toUpperCase();
    if (!code) return;

    setAddError('');
    setAddLoading(true);

    try {
      const q = query(collection(db, 'users'), where('code', '==', code));
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error('Kode karyawan tidak ditemukan.');
      }

      const targetDoc = snap.docs[0];
      const targetUser = targetDoc.data();
      const targetId = targetDoc.id;

      if (activeChat.participants?.includes(targetId)) {
        throw new Error('Karyawan sudah menjadi anggota grup.');
      }

      const chatRef = doc(db, 'chats', activeChat.id);
      await updateDoc(chatRef, {
        participants: arrayUnion(targetId),
        participantCodes: arrayUnion(code),
        [`participantNames.${targetId}`]: targetUser.name,
        lastMessage: `${profile.name} menambahkan ${targetUser.name}`,
        lastMessageTime: serverTimestamp()
      });

      await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
        type: 'system',
        text: `${profile.name} telah menambahkan ${targetUser.name} ke grup.`,
        timestamp: serverTimestamp()
      });

      setAddCode('');
      showToast(`${targetUser.name} berhasil ditambahkan ke grup!`);
    } catch (err: any) {
      setAddError(err.message || 'Gagal menambahkan anggota');
    } finally {
      setAddLoading(false);
    }
  };

  // Remove member from group
  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Keluarkan ${memberName} dari grup?`)) return;

    try {
      const chatRef = doc(db, 'chats', activeChat.id);
      await updateDoc(chatRef, {
        participants: arrayRemove(memberId),
        lastMessage: `${profile.name} mengeluarkan ${memberName}`,
        lastMessageTime: serverTimestamp()
      });

      await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
        type: 'system',
        text: `${profile.name} telah mengeluarkan ${memberName} dari grup.`,
        timestamp: serverTimestamp()
      });

      showToast(`${memberName} dikeluarkan dari grup.`);
    } catch (err: any) {
      console.error(err);
      showToast('Gagal mengeluarkan anggota.');
    }
  };

  // Leave group
  const handleLeaveGroup = async () => {
    if (!confirm('Apakah Anda yakin ingin keluar dari grup ini?')) return;

    try {
      const chatRef = doc(db, 'chats', activeChat.id);
      await updateDoc(chatRef, {
        participants: arrayRemove(user.id),
        lastMessage: `${profile.name} keluar dari grup`,
        lastMessageTime: serverTimestamp()
      });

      await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
        type: 'system',
        text: `${profile.name} telah meninggalkan grup.`,
        timestamp: serverTimestamp()
      });

      onClose();
      if (onLeaveGroup) onLeaveGroup();
    } catch (err: any) {
      console.error(err);
      showToast('Gagal keluar dari grup.');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-xl border border-[#e1e4e8] max-w-md w-full overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#f0f2f5] border-b border-[#ddd] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[#1c1e21]">
            <Users className="w-5 h-5 text-[#128c7e]" />
            <h3 className="font-bold text-sm">Informasi Grup</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#e1e4e8] rounded-full text-[#54656f] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 divide-y divide-[#f0f2f5]">
          {/* Group Overview Banner */}
          <div className="pb-5 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#25d366] text-white flex items-center justify-center text-2xl font-bold shadow-sm mb-3">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-[#1c1e21]">{activeChat.name}</h2>
            <p className="text-xs text-[#54656f] mt-0.5">
              {activeChat.participants?.length || 0} Anggota Terdaftar
            </p>

            {/* Creator info */}
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-[#f0f2f5] rounded-full text-[11px] text-[#54656f] border border-[#e1e4e8]">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>Dibuat oleh: <strong className="text-[#1c1e21]">{activeChat.creatorName || 'Admin'}</strong></span>
            </div>
          </div>

          {/* Pending Join Requests (Visible to Creator / Admins) */}
          {isAdmin && joinRequests.length > 0 && (
            <div className="py-4">
              <h4 className="text-xs font-bold text-[#128c7e] uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Permintaan Bergabung</span>
                <span className="bg-[#128c7e] text-white text-[10px] px-1.5 py-0.2 rounded-full">
                  {joinRequests.length}
                </span>
              </h4>
              <p className="text-[11px] text-[#667781] mb-3">
                Karyawan berikut meminta izin masuk grup dari Direktori:
              </p>
              
              <div className="space-y-2">
                {joinRequests.map((req: any, idx: number) => {
                  const reqUser = usersMap?.[req.userId];
                  return (
                    <div 
                      key={idx} 
                      className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {reqUser?.photoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img 
                            src={reqUser.photoURL} 
                            alt={req.userName} 
                            className="w-8 h-8 rounded-full object-cover shrink-0 border border-amber-300"
                          />
                        ) : (
                          <div 
                            className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0"
                            style={{ backgroundColor: reqUser?.avatarColor || '#128c7e' }}
                          >
                            {req.userName?.substring(0, 2).toUpperCase() || 'KY'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#1c1e21] truncate">{req.userName}</p>
                          <p className="text-[10px] font-mono text-[#128c7e] font-bold">Kode: {req.userCode}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleApproveRequest(req)}
                          className="px-2.5 py-1 bg-[#128c7e] hover:bg-[#0f7a6d] text-white text-[11px] font-semibold rounded-lg shadow-xs transition-colors"
                        >
                          Terima
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req)}
                          className="px-2 py-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-[11px] rounded-lg transition-colors"
                        >
                          Tolak
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Member Form (Admins/Creator) */}
          {isAdmin && (
            <div className="py-4">
              <h4 className="text-xs font-bold text-[#1c1e21] mb-2 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-[#128c7e]" />
                <span>Tambah Anggota Baru</span>
              </h4>
              <form onSubmit={handleAddMemberByCode} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ketik 6-digit kode rekan..."
                  value={addCode}
                  onChange={(e) => setAddCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="flex-1 px-3 py-1.5 bg-[#f0f2f5] border border-[#d1d7db] rounded-xl text-xs font-mono font-bold outline-none focus:border-[#128c7e]"
                />
                <button
                  type="submit"
                  disabled={addLoading || !addCode.trim()}
                  className="px-4 py-1.5 bg-[#128c7e] hover:bg-[#0f7a6d] text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-40"
                >
                  {addLoading ? '...' : 'Tambah'}
                </button>
              </form>
              {addError && (
                <p className="text-[11px] text-red-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{addError}</span>
                </p>
              )}
            </div>
          )}

          {/* Members List */}
          <div className="py-4">
            <h4 className="text-xs font-bold text-[#1c1e21] uppercase tracking-wider mb-3">
              Daftar Anggota ({activeChat.participants?.length || 0})
            </h4>

            <div className="space-y-2">
              {activeChat.participants?.map((participantId: string) => {
                const memberName = activeChat.participantNames?.[participantId] || 'Karyawan';
                const isMemberCreator = participantId === activeChat.creatorId;
                const isMemberAdmin = activeChat.admins?.includes(participantId);
                const isSelf = participantId === user.id;

                return (
                  <div 
                    key={participantId}
                    className="flex items-center justify-between p-2 hover:bg-[#f5f6f6] rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {usersMap?.[participantId]?.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                          src={usersMap[participantId].photoURL} 
                          alt={memberName} 
                          className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#e1e4e8]"
                        />
                      ) : (
                        <div 
                          className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0"
                          style={{ backgroundColor: usersMap?.[participantId]?.avatarColor || '#128c7e' }}
                        >
                          {memberName.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#1c1e21] flex items-center gap-1.5">
                          <span>{memberName}</span>
                          {isSelf && <span className="text-[10px] text-[#667781] font-normal">(Anda)</span>}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {isMemberCreator ? (
                            <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5">
                              <Crown className="w-2.5 h-2.5" /> Pembuat
                            </span>
                          ) : isMemberAdmin ? (
                            <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5">
                              <Shield className="w-2.5 h-2.5" /> Admin
                            </span>
                          ) : (
                            <span className="text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-full">
                              Anggota
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions: Admin removing non-creator members */}
                    {isAdmin && !isMemberCreator && !isSelf && (
                      <button
                        onClick={() => handleRemoveMember(participantId, memberName)}
                        className="p-1.5 text-[#888] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={`Keluarkan ${memberName} dari grup`}
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave Group Action */}
          <div className="pt-4">
            <button
              onClick={handleLeaveGroup}
              className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 border border-red-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar dari Grup Ini</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
