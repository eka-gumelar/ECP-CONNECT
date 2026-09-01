'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/lib/auth';
import { 
  collection, query, where, getDocs, limit, 
  doc, updateDoc, arrayUnion 
} from 'firebase/firestore';
import { 
  X, Search, Users, MessageSquare, Plus, Check, Copy, 
  Clock, Send, ChevronRight, PanelRightClose, RotateCw
} from 'lucide-react';

interface DirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  currentProfile: UserProfile;
  onStartDirectChat: (targetUser: UserProfile) => void;
  onOpenGroupChat: (group: any) => void;
  showToast: (msg: string) => void;
  usersMap?: Record<string, UserProfile>;
}

export default function DirectoryModal({
  isOpen,
  onClose,
  currentUser,
  currentProfile,
  onStartDirectChat,
  onOpenGroupChat,
  showToast,
  usersMap
}: DirectoryModalProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>(() => {
    if (usersMap && Object.keys(usersMap).length > 0) {
      return Object.values(usersMap).filter(u => u.id !== currentUser.id);
    }
    return [];
  });
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<Record<string, boolean>>({});

  // High-efficiency on-demand data fetcher (eliminates continuous real-time snapshot reads)
  const fetchDirectoryData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // 1. Fetch Users (Limit 150)
      const qUsers = query(collection(db, 'users'), limit(150));
      const snapUsers = await getDocs(qUsers);
      const uList = snapUsers.docs
        .map(d => ({ id: d.id, ...d.data() } as UserProfile))
        .filter(u => u.id !== currentUser.id);
      setUsers(uList);

      // 2. Fetch Public Groups (Limit 150)
      const qGroups = query(
        collection(db, 'chats'),
        where('type', '==', 'group'),
        limit(150)
      );
      const snapGroups = await getDocs(qGroups);
      const gList = snapGroups.docs.map(d => ({ id: d.id, ...d.data() }));
      setGroups(gList);

      if (isManualRefresh) {
        showToast('Direktori diperbarui! 🔄');
      }
    } catch (err) {
      console.error('Error fetching directory data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser.id, showToast]);

  // Fetch when opened asynchronously without synchronous effect setState
  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    (async () => {
      try {
        const [snapUsers, snapGroups] = await Promise.all([
          getDocs(query(collection(db, 'users'), limit(150))),
          getDocs(query(collection(db, 'chats'), where('type', '==', 'group'), limit(150)))
        ]);
        if (!active) return;
        const uList = snapUsers.docs
          .map(d => ({ id: d.id, ...d.data() } as UserProfile))
          .filter(u => u.id !== currentUser.id);
        setUsers(uList);
        const gList = snapGroups.docs.map(d => ({ id: d.id, ...d.data() }));
        setGroups(gList);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [isOpen, currentUser.id]);

  // Request permission to join group
  const handleRequestJoin = useCallback(async (group: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setPendingRequests(prev => ({ ...prev, [group.id]: true }));
      const chatRef = doc(db, 'chats', group.id);
      await updateDoc(chatRef, {
        joinRequests: arrayUnion({
          userId: currentUser.id,
          userName: currentProfile?.name || 'Karyawan',
          userCode: currentProfile?.code || '------',
          requestedAt: new Date().toISOString()
        })
      });

      showToast(`Permintaan izin gabung grup "${group.name}" terkirim ke pembuat!`);
    } catch (err: any) {
      console.error(err);
      showToast('Gagal mengirim permintaan izin gabung.');
    }
  }, [currentUser.id, currentProfile, showToast]);

  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filtered lists
  const queryLower = searchQuery.toLowerCase().trim();
  const filteredUsers = users.filter(u => 
    (u.name && u.name.toLowerCase().includes(queryLower)) ||
    (u.code && u.code.toLowerCase().includes(queryLower))
  );

  const filteredGroups = groups.filter(g => 
    g.name && g.name.toLowerCase().includes(queryLower)
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Backdrop (only on small screens) */}
      <div 
        className="fixed inset-0 z-40 bg-black/40 md:hidden animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Docked Right Panel (Attached to right of screen, compact width) */}
      <aside 
        className="fixed md:relative right-0 top-0 bottom-0 z-40 md:z-20 w-[85vw] max-w-[300px] md:w-[300px] shrink-0 bg-white border-l border-[#e1e4e8] shadow-2xl md:shadow-none flex flex-col h-full animate-in slide-in-from-right duration-200 ease-out"
        id="docked-directory-panel"
      >
        {/* Header with Hide/Slide Button */}
        <div className="h-[60px] px-3.5 bg-[#f0f2f5] border-b border-[#ddd] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[#1c1e21] min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#128c7e]/10 text-[#128c7e] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xs md:text-sm leading-tight text-[#1c1e21] truncate">Direktori</h3>
              <p className="text-[10px] text-[#667781] truncate">Rekan Kerja & Grup</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Segarkan / Refresh Button */}
            <button
              onClick={() => fetchDirectoryData(true)}
              disabled={refreshing || loading}
              className="p-1.5 rounded-lg bg-white border border-[#ddd] hover:bg-[#e1e4e8] text-[#54656f] hover:text-[#128c7e] transition-all shadow-2xs group shrink-0 active:scale-95 cursor-pointer"
              title="Segarkan Direktori"
            >
              <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#128c7e]' : 'group-hover:rotate-45 transition-transform'}`} />
            </button>

            {/* Sembunyikan / Hide Button */}
            <button 
              onClick={onClose}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#ddd] hover:bg-[#e1e4e8] text-[#54656f] hover:text-[#128c7e] transition-all text-xs font-semibold shadow-2xs group shrink-0 active:scale-95 cursor-pointer"
              title="Sembunyikan Direktori (Geser Kanan / Alt+D)"
            >
              <span className="text-[11px]">Sembunyikan</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#ddd] bg-[#f0f2f5] px-3 pt-1.5 gap-1.5 shrink-0">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 pb-2 px-2 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'users' 
                ? 'border-[#128c7e] text-[#128c7e]' 
                : 'border-transparent text-[#667781] hover:text-[#1c1e21]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Karyawan ({filteredUsers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('groups')}
            className={`flex-1 pb-2 px-2 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'groups' 
                ? 'border-[#128c7e] text-[#128c7e]' 
                : 'border-transparent text-[#667781] hover:text-[#1c1e21]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Grup ({filteredGroups.length})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-2.5 bg-white border-b border-[#eee] shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#54656f] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder={
                activeTab === 'users' 
                  ? "Cari nama atau kode 6-digit..." 
                  : "Cari nama grup..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-[#f0f2f5] border border-[#d1d7db] rounded-lg text-xs outline-none focus:border-[#128c7e] text-[#1c1e21]"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-[#888] hover:text-[#333] text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2 bg-[#f8f9fa]">
          {activeTab === 'users' ? (
            filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#667781]">
                {loading ? 'Memuat direktori...' : 'Tidak ada karyawan yang cocok.'}
              </div>
            ) : (
              filteredUsers.map((targetUser) => (
                <div
                  key={targetUser.id}
                  className="p-2.5 bg-white rounded-xl border border-[#e1e4e8] shadow-2xs hover:border-[#128c7e] transition-all flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {targetUser.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={targetUser.photoURL} 
                        alt={targetUser.name} 
                        className="w-9 h-9 rounded-full object-cover shrink-0 border border-[#e1e4e8]"
                      />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs"
                        style={{ backgroundColor: targetUser.avatarColor || '#34b7f1' }}
                      >
                        {targetUser.name?.substring(0, 2).toUpperCase() || 'US'}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1c1e21] truncate leading-tight">{targetUser.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] font-mono font-bold text-[#128c7e] bg-[#d9fdd3] px-1.5 py-0.2 rounded">
                          {targetUser.code}
                        </span>
                        <button
                          onClick={(e) => handleCopyCode(targetUser.code, e)}
                          className="p-0.5 text-[#667781] hover:text-[#128c7e] transition-colors"
                          title="Salin kode"
                        >
                          {copiedCode === targetUser.code ? (
                            <Check className="w-3 h-3 text-[#25d366]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onStartDirectChat(targetUser);
                    }}
                    className="px-2.5 py-1 bg-[#128c7e] hover:bg-[#0f7a6d] text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors shrink-0"
                    title={`Mulai percakapan dengan ${targetUser.name}`}
                  >
                    <Send className="w-3 h-3" />
                    <span>Chat</span>
                  </button>
                </div>
              ))
            )
          ) : (
            filteredGroups.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#667781]">
                {loading ? 'Memuat direktori grup...' : 'Tidak ada grup yang cocok.'}
              </div>
            ) : (
              filteredGroups.map((group) => {
                const isMember = group.participants?.includes(currentUser.id);
                const hasRequested = pendingRequests[group.id] || 
                  group.joinRequests?.some((r: any) => r.userId === currentUser.id);

                return (
                  <div
                    key={group.id}
                    className="p-2.5 bg-white rounded-xl border border-[#e1e4e8] shadow-2xs hover:border-[#128c7e] transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#25d366] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs">
                          <MessageSquare className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#1c1e21] truncate leading-tight">{group.name}</p>
                          <p className="text-[10px] text-[#667781] truncate mt-0.5">
                            {group.participants?.length || 0} Anggota • Oleh: {group.creatorName || 'Admin'}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isMember ? (
                          <button
                            onClick={() => {
                              onOpenGroupChat(group);
                            }}
                            className="px-2 py-1 bg-[#d9fdd3] text-[#128c7e] hover:bg-[#b7ebc0] rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            <span>Buka</span>
                          </button>
                        ) : hasRequested ? (
                          <div className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Menunggu</span>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleRequestJoin(group, e)}
                            className="px-2 py-1 bg-[#128c7e] hover:bg-[#0f7a6d] text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 shadow-2xs transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Gabung</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-[#f0f2f5] border-t border-[#ddd] flex items-center justify-between text-[10px] text-[#667781] shrink-0">
          <span>{activeTab === 'users' ? `${filteredUsers.length} Karyawan` : `${filteredGroups.length} Grup`}</span>
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-[#128c7e] hover:underline font-bold"
          >
            <span>Sembunyikan panel</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </aside>
    </>
  );
}
