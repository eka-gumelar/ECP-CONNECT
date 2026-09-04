'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from './AuthProvider';
import { db } from '@/lib/firebase';
import { UserProfile, updateUserPresence, hashPassword } from '@/lib/auth';
import { 
  collection, query, where, onSnapshot, orderBy, 
  addDoc, serverTimestamp, getDocs, doc, setDoc, updateDoc,
  limit, limitToLast, arrayUnion, arrayRemove, deleteDoc
} from 'firebase/firestore';
import { 
  Search, LogOut, Send, Paperclip, 
  User as UserIcon, MessageSquare, Plus, Copy, Check, FileText, Download,
  RefreshCw, Lock, Unlock, Bell, BellOff, CheckCheck, CornerUpLeft, Trash2, 
  Star, Info, Forward, MoreVertical, X, AlertCircle, Shield,
  CheckCircle2, ShieldAlert,
  Image as LucideImage, Eye, ZoomIn, ZoomOut, UploadCloud,
  ArrowLeft, Radio, AtSign, HelpCircle, Users, Settings, Clock, RotateCcw, Calendar,
  ChevronDown, RotateCw, Smile, Sparkles, ThumbsUp, Heart, SmilePlus
} from 'lucide-react';
import { processFileForUpload, downloadDataUrl } from '@/lib/media';
import ShortcutsModal from './ShortcutsModal';
import UserProfileModal from './UserProfileModal';
import GroupInfoModal from './GroupInfoModal';
import DirectoryModal from './DirectoryModal';
import StickerMakerModal from './StickerMakerModal';
import AttachmentPreviewModal, { PendingAttachmentData } from './AttachmentPreviewModal';
import EmojiStickerPicker, { StickerItem } from './EmojiStickerPicker';

// Web Audio API notification sound (WhatsApp chime & Ping alarm)
function playSound(type: 'receive' | 'send' | 'ping' = 'receive') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'ping') {
      // High energy urgent ping tone
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(440, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.35);
      osc2.stop(ctx.currentTime + 0.35);
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'receive') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(784, ctx.currentTime); // G5
      osc.frequency.exponentialRampToValueAtTime(1046, ctx.currentTime + 0.12); // C6
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(480, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(240, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }
  } catch (e) {
    // Ignore audio permission restrictions
  }
}

export default function ChatApp() {
  const { user, profile, firebaseUser, signOutCode, signOutGoogleAuth } = useAuth();
  
  // App state
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingFailed, setSendingFailed] = useState<string | null>(null);

  // App Lock
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem('ecp_connect_locked') === 'true';
    } catch {
      return false;
    }
  });

  const [unlockKey, setUnlockKey] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);

  // Track isAppLocked and activeChat in refs for async event listeners and privacy mode
  const isAppLockedRef = useRef(isAppLocked);
  useEffect(() => {
    isAppLockedRef.current = isAppLocked;
  }, [isAppLocked]);

  const activeChatIdRef = useRef<string | null>(activeChat?.id || null);
  useEffect(() => {
    activeChatIdRef.current = activeChat?.id || null;
  }, [activeChat?.id]);

  // Desktop Notifications
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
    return Notification.permission;
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Show quick toast notification helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Network & Firestore connection status
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return navigator.onLine;
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsNetworkOnline(true);
      showToast('Koneksi internet kembali normal 🌐');
    };
    const handleOffline = () => {
      setIsNetworkOnline(false);
      showToast('Koneksi internet terputus. Berjalan dalam mode offline.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  // Online Presence of Active Contact
  const [contactPresence, setContactPresence] = useState<{ isOnline?: boolean; lastSeen?: any } | null>(null);

  // Search & New Chat by 6-digit Code
  const [searchCode, setSearchCode] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Group creation
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupCodes, setGroupCodes] = useState('');
  const [groupError, setGroupError] = useState('');

  // Replying
  const [replyingTo, setReplyingTo] = useState<any>(null);

  // Right-click context menus
  const [messageContextMenu, setMessageContextMenu] = useState<{
    x: number;
    y: number;
    message: any;
  } | null>(null);

  const [chatContextMenu, setChatContextMenu] = useState<{
    x: number;
    y: number;
    chat: any;
  } | null>(null);

  // Modals: Message Info & Forward
  const [infoModalMessage, setInfoModalMessage] = useState<any>(null);
  const [forwardModalMessage, setForwardModalMessage] = useState<any>(null);
  const [showContactDrawer, setShowContactDrawer] = useState(false);

  // New Modals
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);

  // Auto-Lock Interval (minutes: 0 = disabled, 1, 2, 5, 10, 15, 30)
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(() => {
    if (typeof window === 'undefined') return 5;
    try {
      const saved = localStorage.getItem('ecp_connect_autolock');
      return saved !== null ? parseInt(saved, 10) : 5;
    } catch {
      return 5;
    }
  });

  // Chat In-line Search & Date Range Filter
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchKeyword, setChatSearchKeyword] = useState('');
  const [chatSearchStartDate, setChatSearchStartDate] = useState('');
  const [chatSearchEndDate, setChatSearchEndDate] = useState('');

  // High-performance Cached Users Map (Instant avatar rendering & zero-read startup)
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const cached = localStorage.getItem('ecp_connect_users_cache');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Group Member Tagging (@) State
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionCursorPos, setMentionCursorPos] = useState<number>(0);

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // File upload, image lightbox & scroll
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadingStatus, setUploadingStatus] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [activeLightboxImage, setActiveLightboxImage] = useState<{
    url: string;
    name: string;
    sender?: string;
    time?: any;
    size?: string;
  } | null>(null);
  const [lightboxZoomed, setLightboxZoomed] = useState(false);

  // Message Stream Scroll & Quota Optimization
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [newMessagesWhileScrolled, setNewMessagesWhileScrolled] = useState(0);
  const prevMessagesLengthRef = useRef(0);
  const isInitialMsgLoadRef = useRef(true);
  const justSentMessageRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const prevChatIdRef = useRef<string | null>(null);

  // Optimistic UI for instant sending without delay
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);

  // PING Cooldown (1-minute / 60-seconds limit to prevent spam)
  const [pingCooldownSeconds, setPingCooldownSeconds] = useState<number>(0);
  const lastPingTimesRef = useRef<Record<string, number>>({});

  // Emoji & Sticker Picker State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerMaker, setShowStickerMaker] = useState(false);
  const [stickerMakerInitialImage, setStickerMakerInitialImage] = useState<File | string | null>(null);
  const [customStickers, setCustomStickers] = useState<StickerItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('ecp_connect_custom_stickers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Attachment Preview with Caption modal state
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachmentData | null>(null);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const lastPasteTimeRef = useRef<number>(0);

  // Message Reactions & Hover State
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [reactionPickerMessage, setReactionPickerMessage] = useState<any | null>(null);

  // Ping Cooldown Interval Decrementer (1s tick)
  useEffect(() => {
    if (pingCooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setPingCooldownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pingCooldownSeconds]);

  // Combined Server + Optimistic Messages
  const combinedMessages = useMemo(() => {
    const serverIds = new Set(messages.map(m => m.id));
    const pendingForChat = optimisticMessages.filter(opt => {
      if (opt.chatId !== activeChat?.id) return false;
      if (serverIds.has(opt.id)) return false;
      // Match with server doc if already synced
      const alreadySynced = messages.some(m => 
        (m.clientTempId && m.clientTempId === opt.id) ||
        (m.senderId === opt.senderId && m.text === opt.text && m.type === opt.type && opt.clientTime && Math.abs((m.timestamp?.toDate ? m.timestamp.toDate().getTime() : 0) - opt.clientTime) < 15000)
      );
      return !alreadySynced;
    });
    return [...messages, ...pendingForChat];
  }, [messages, optimisticMessages, activeChat?.id]);

  // Save custom sticker to collection & localStorage
  const handleSaveCustomSticker = useCallback((dataUrl: string) => {
    const newSticker: StickerItem = {
      id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: 'Stiker Kustom',
      url: dataUrl,
      isCustom: true
    };
    setCustomStickers(prev => {
      const updated = [newSticker, ...prev.filter(s => s.url !== dataUrl).slice(0, 49)];
      try {
        localStorage.setItem('ecp_connect_custom_stickers', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast('Stiker kustom disimpan ke koleksi! ✨');
  }, [showToast]);

  // Delete custom sticker from collection
  const handleDeleteCustomSticker = useCallback((id: string) => {
    setCustomStickers(prev => {
      const updated = prev.filter(s => s.id !== id);
      try {
        localStorage.setItem('ecp_connect_custom_stickers', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast('Stiker dihapus dari koleksi.');
  }, [showToast]);

  // Helper to safely stop PING sound loop for a chat
  const stopPingForChat = useCallback((chatId: string) => {
    if (pingTimersRef.current[chatId]) {
      clearInterval(pingTimersRef.current[chatId]);
      delete pingTimersRef.current[chatId];
    }
  }, []);

  // Check if there is an active PING in the currently open chat directed at current user
  const hasActivePingForMe = useMemo(() => {
    if (!activeChat || !user) return false;
    const ap = activeChat.activePing;
    if (!ap) {
      // Fallback: check if the latest message was an unread PING from another user
      return Boolean(
        activeChat.lastMessage === '🔔 PING!' &&
        activeChat.unreadFor?.includes(user.id) &&
        activeChat.lastMessageSender !== profile?.name
      );
    }
    return Boolean(ap.active && ap.senderId !== user.id);
  }, [activeChat, user, profile?.name]);

  const activePingSenderName = useMemo(() => {
    if (!activeChat) return 'Rekan Kerja';
    return activeChat.activePing?.senderName || activeChat.lastMessageSender || 'Rekan Kerja';
  }, [activeChat]);

  // Recipient clicks "Stop Ping": stops audio loop, clears ping signal, provides feedback
  const handleStopPingFeedback = useCallback(async () => {
    if (!activeChat || !user || !profile) return;
    
    // 1. Immediately stop local audio chime loop
    stopPingForChat(activeChat.id);

    // 2. Mark activePing as stopped in Firestore with user acknowledgment feedback
    try {
      const chatRef = doc(db, 'chats', activeChat.id);
      await updateDoc(chatRef, {
        'activePing.active': false,
        'activePing.stoppedBy': user.id,
        'activePing.stoppedByName': profile.name,
        'activePing.stoppedAt': Date.now(),
        unreadFor: arrayRemove(user.id)
      });

      // 3. Immediate local state update
      setActiveChat((prev: any) => prev ? {
        ...prev,
        activePing: {
          ...(prev.activePing || {}),
          active: false,
          stoppedBy: user.id,
          stoppedByName: profile.name,
          stoppedAt: Date.now()
        },
        unreadFor: (prev.unreadFor || []).filter((id: string) => id !== user.id)
      } : prev);

      showToast('✓ Sinyal PING dihentikan. Konfirmasi Anda telah terkirim.');
    } catch (err) {
      console.error('Error stopping ping:', err);
      showToast('Sinyal PING dihentikan.');
    }
  }, [activeChat, user, profile, stopPingForChat, showToast]);

  // Message pagination (Quota-friendly: only fetch the last 50 messages by default)
  const [messagesLimit, setMessagesLimit] = useState(50);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [loadAllTimeMessages, setLoadAllTimeMessages] = useState(false);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Consider within 120px as "near bottom"
    const isNear = distanceFromBottom <= 120;
    isNearBottomRef.current = isNear;
    setShowScrollBottomBtn(!isNear);
    if (isNear) {
      setNewMessagesWhileScrolled(0);
    }
  }, []);

  const handleLoadOlderMessages = useCallback(() => {
    const el = messagesContainerRef.current;
    if (el) {
      prevScrollHeightRef.current = el.scrollHeight;
    }
    setLoadingOlderMessages(true);
    setLoadAllTimeMessages(true);
    setMessagesLimit(prev => prev + 50);
  }, []);

  // Close lightbox on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeLightboxImage) {
        setActiveLightboxImage(null);
        setLightboxZoomed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLightboxImage]);

  // 1. Immediate Notification Permission Request on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          setNotifPermission(perm);
          if (perm === 'granted') {
            showToast('Izin notifikasi desktop aktif! 🔔');
          }
        }).catch(() => {});
      }
    }
  }, [showToast]);

  // 2. Auto-Lock Inactivity Timer
  useEffect(() => {
    if (isAppLocked || autoLockMinutes <= 0) return;

    let timeoutId: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (!isAppLocked) {
          setIsAppLocked(true);
          sessionStorage.setItem('ecp_connect_locked', 'true');
          showToast('Aplikasi terkunci otomatis karena tidak ada aktivitas.');
        }
      }, autoLockMinutes * 60 * 1000);
    };

    resetTimer();

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [isAppLocked, autoLockMinutes, showToast]);

  // Robust Desktop Notification sender
  const sendDesktopNotification = useCallback((title: string, body: string, fallbackToToast: boolean = false) => {
    if (typeof window === 'undefined') return;
    
    if (Notification.permission !== 'granted') {
      if (fallbackToToast) showToast(`[Notifikasi Desktop Nonaktif] ${title}: ${body}`);
      return;
    }

    try {
      const iconUrl = `${window.location.origin}/favicon.ico`;
      const notif = new Notification(title, {
        body,
        icon: iconUrl,
        badge: iconUrl,
        tag: 'ecp-connect-' + Date.now()
      });

      notif.onclick = () => {
        window.focus();
        try {
          window.parent?.focus();
        } catch (e) {}
        notif.close();
      };
    } catch (err) {
      console.warn('Native Notification constructor error, trying serviceWorker:', err);
      let swSuccess = false;
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon: `${window.location.origin}/favicon.ico`,
            tag: 'ecp-connect-' + Date.now()
          }).then(() => { swSuccess = true; }).catch(() => {});
        }).catch(() => {});
      }
      
      if (!swSuccess && fallbackToToast) {
        showToast(`[Pesan Masuk] ${title}`);
      }
    }
  }, [showToast]);

  // Desktop & in-app notification dispatcher with Privacy Mode when App is Locked
  const notifyIncoming = useCallback((params: {
    senderName: string;
    chatName?: string;
    isGroup?: boolean;
    messageText?: string;
    isPing?: boolean;
  }) => {
    const isLocked = isAppLockedRef.current;
    
    if (params.isPing) {
      playSound('ping');
      const title = `🔔 PING! dari ${params.senderName}`;
      // In privacy mode when app is locked: only the sender's name is exposed, hide contents
      const body = isLocked 
        ? 'Panggilan perhatian masuk (Layar Terkunci)'
        : (params.chatName ? `Panggilan perhatian di ${params.chatName}` : 'Panggilan perhatian masuk di ECP Connect!');
      
      sendDesktopNotification(title, body, true);
      if (!isLocked) {
        showToast(`🔔 PING diterima dari ${params.senderName}!`);
      }
      return;
    }

    playSound('receive');
    // Privacy mode when app is locked: ONLY show sender's name!
    const title = isLocked
      ? (params.isGroup && params.chatName ? `${params.senderName} (${params.chatName})` : `${params.senderName}`)
      : (params.isGroup && params.chatName ? `[${params.chatName}] ${params.senderName}` : `Pesan baru dari ${params.senderName}`);
    
    // Privacy body: do NOT reveal message content on locked screen
    const body = isLocked 
      ? 'Pesan baru diterima (Layar Terkunci)' 
      : (params.messageText || 'Pesan baru diterima');

    sendDesktopNotification(title, body, true);
  }, [sendDesktopNotification, showToast]);

  const testDesktopNotification = useCallback(() => {
    playSound('ping');
    sendDesktopNotification(
      'ECP Connect • Uji Notifikasi',
      '🔔 Notifikasi desktop Anda berfungsi normal! Notifikasi pesan & PING akan muncul di layar desktop.'
    );
    showToast('🔔 Uji notifikasi desktop dikirim!');
  }, [sendDesktopNotification, showToast]);

  const requestDesktopNotification = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotifPermission(perm);
        if (perm === 'granted') {
          showToast('Notifikasi desktop diaktifkan! 🔔');
          sendDesktopNotification(
            'ECP Connect',
            'Notifikasi desktop ECP Connect berhasil diaktifkan.'
          );
        } else {
          showToast('Izin notifikasi tidak diizinkan browser.');
        }
      } catch (e) {
        console.error('Error requesting notification permission:', e);
      }
    }
  };

  // 2. High-Efficiency Cached Users Map (Saves tens of thousands of realtime snapshot reads)
  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      try {
        const qUsers = query(collection(db, 'users'), limit(200));
        const snap = await getDocs(qUsers);
        if (!isMounted) return;

        const map: Record<string, UserProfile> = {};
        snap.docs.forEach((docSnap) => {
          map[docSnap.id] = { id: docSnap.id, ...docSnap.data() } as UserProfile;
        });

        setUsersMap(map);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('ecp_connect_users_cache', JSON.stringify(map));
          } catch {}
        }
      } catch (err) {
        console.error("Error loading users map", err);
      }
    };

    loadUsers();

    // Refresh user cache every 10 minutes in background (or on demand)
    const interval = setInterval(loadUsers, 600000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 3. User Presence Heartbeat (Online / Last Seen) - Throttled & Eco-friendly
  useEffect(() => {
    if (!user?.id) return;

    updateUserPresence(user.id, true);

    // Heartbeat every 3.5 minutes, only if tab is currently visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        updateUserPresence(user.id, true);
      }
    }, 210000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateUserPresence(user.id, true);
      }
    };

    const handleBeforeUnload = () => {
      updateUserPresence(user.id, false);
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user?.id]);

  // 4. Fetch User's Chats & Listen for Unread Ping/Messages (Limit 50 for quota protection)
  const isInitialChatsLoadRef = useRef(true);
  const pingTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  
  useEffect(() => {
    if (!user?.id) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.id),
      orderBy('lastMessageTime', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatData = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setChats(chatData);

      // Keep activeChat updated without opening a separate duplicate onSnapshot listener
      const currentActiveId = activeChatIdRef.current;
      if (currentActiveId) {
        const fresh = chatData.find((c: any) => c.id === currentActiveId);
        if (fresh) {
          setActiveChat((prev: any) => (prev?.id === fresh.id ? { ...prev, ...fresh } : prev));
        }
      }

      // Check unread status and activePing status for active ping timers
      chatData.forEach((chat: any) => {
        const isUnreadForMe = chat.unreadFor?.includes(user.id);
        const hasActivePing = chat.activePing ? (chat.activePing.active && chat.activePing.senderId !== user.id) : isUnreadForMe;
        if ((!isUnreadForMe || !hasActivePing) && pingTimersRef.current[chat.id]) {
          clearInterval(pingTimersRef.current[chat.id]);
          delete pingTimersRef.current[chat.id];
        }
      });

      if (!isInitialChatsLoadRef.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'modified' || change.type === 'added') {
            const chat: any = change.doc.data();
            const chatId = change.doc.id;
            const isUnreadForMe = chat.unreadFor?.includes(user.id);
            const isCurrentActiveChat = activeChatIdRef.current === chatId;
            const isWindowHidden = typeof document !== 'undefined' && document.hidden;
            const isAppLockedCurrent = isAppLockedRef.current;

            // Only consider recent activity (within 30 seconds) so opening or modifying older chats never plays sound
            const lastTime = chat.lastMessageTime?.toDate ? chat.lastMessageTime.toDate().getTime() : (chat.activePing?.timestamp || 0);
            const isRecent = lastTime > 0 && Math.abs(Date.now() - lastTime) < 30000;

            if (isUnreadForMe && (!isCurrentActiveChat || isWindowHidden || isAppLockedCurrent) && isRecent) {
              const isPing = chat.lastMessage?.includes('🔔 PING!') || (chat.activePing?.active && chat.activePing?.senderId !== user.id);
              const senderName = chat.lastMessageSender || (chat.participantNames ? Object.values(chat.participantNames).join(', ') : 'Rekan Kerja');

              if (isPing) {
                notifyIncoming({
                  senderName,
                  chatName: chat.name,
                  isGroup: chat.type === 'group',
                  isPing: true
                });

                // Repetitive ping interval (every 5 seconds for 1 minute max = 12 times)
                if (change.type === 'added' || (change.type === 'modified' && chat.lastMessageTime)) {
                  if (pingTimersRef.current[chatId]) {
                    clearInterval(pingTimersRef.current[chatId]);
                  }
                  
                  let pingCount = 0;
                  pingTimersRef.current[chatId] = setInterval(() => {
                    pingCount++;
                    if (pingCount >= 12) {
                      clearInterval(pingTimersRef.current[chatId]);
                      delete pingTimersRef.current[chatId];
                      return;
                    }
                    notifyIncoming({
                      senderName,
                      chatName: chat.name,
                      isGroup: chat.type === 'group',
                      isPing: true
                    });
                  }, 5000);
                }
              } else {
                notifyIncoming({
                  senderName,
                  chatName: chat.name,
                  isGroup: chat.type === 'group',
                  messageText: chat.lastMessage,
                  isPing: false
                });
              }
            }
          }
        });
      } else {
        isInitialChatsLoadRef.current = false;
      }
    }, (err) => {
      console.error("Error fetching chats", err);
    });

    const timersRef = pingTimersRef;
    return () => {
      unsubscribe();
      Object.values(timersRef.current).forEach(clearInterval);
    };
  }, [user?.id, notifyIncoming]);

  // 5. Fetch Messages for Active Chat & Mark as Read (Quota-Optimized with limitToLast & smart auto-scroll)
  const activeChatUnreadFor = activeChat?.unreadFor;
  useEffect(() => {
    if (!activeChat?.id || !user?.id) return;

    const currentChatId = activeChat.id;
    const isGroup = activeChat.type === 'group';

    let q;
    if (loadAllTimeMessages) {
      q = query(
        collection(db, `chats/${currentChatId}/messages`),
        orderBy('timestamp', 'asc'),
        limitToLast(messagesLimit)
      );
    } else {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      q = query(
        collection(db, `chats/${currentChatId}/messages`),
        where('timestamp', '>=', fourteenDaysAgo),
        orderBy('timestamp', 'asc'),
        limitToLast(messagesLimit)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // If switched to a new chat, reset scroll states
      if (prevChatIdRef.current !== currentChatId) {
        prevChatIdRef.current = currentChatId;
        isInitialMsgLoadRef.current = true;
        isNearBottomRef.current = true;
        setShowScrollBottomBtn(false);
        setNewMessagesWhileScrolled(0);
        prevMessagesLengthRef.current = 0;
        prevScrollHeightRef.current = 0;
        setLoadAllTimeMessages(false);
      }

      const msgData = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      const newMsgCount = msgData.length;
      const prevMsgCount = prevMessagesLengthRef.current;
      prevMessagesLengthRef.current = newMsgCount;

      setMessages(msgData);
      setHasMoreMessages(snapshot.docs.length >= messagesLimit);

      const wasInitialLoad = isInitialMsgLoadRef.current;

      // Handle loading older messages scroll position restoration
      if (prevScrollHeightRef.current > 0) {
        const el = messagesContainerRef.current;
        if (el) {
          const newScrollHeight = el.scrollHeight;
          el.scrollTop = newScrollHeight - prevScrollHeightRef.current;
          prevScrollHeightRef.current = 0;
        }
        setLoadingOlderMessages(false);
      } else if (wasInitialLoad) {
        // Initial chat load: auto-scroll to the bottom immediately and retry as images load
        isInitialMsgLoadRef.current = false;
        isNearBottomRef.current = true;
        setShowScrollBottomBtn(false);
        setNewMessagesWhileScrolled(0);
        // Instant scroll down
        scrollToBottom(false);
        setTimeout(() => scrollToBottom(false), 50);
        setTimeout(() => scrollToBottom(false), 150);
        setTimeout(() => scrollToBottom(false), 400);
      } else if (justSentMessageRef.current) {
        // Current user sent a message: always scroll down smoothly
        justSentMessageRef.current = false;
        isNearBottomRef.current = true;
        setShowScrollBottomBtn(false);
        setNewMessagesWhileScrolled(0);
        setTimeout(() => scrollToBottom(true), 50);
      } else if (newMsgCount > prevMsgCount) {
        // New incoming message arrived
        if (isNearBottomRef.current) {
          // User is already near bottom: scroll to bottom smoothly
          setTimeout(() => scrollToBottom(true), 50);
        } else {
          // User is reading older messages: DO NOT force scroll! Preserve reading position!
          const diff = newMsgCount - prevMsgCount;
          setNewMessagesWhileScrolled(prev => prev + diff);
          setShowScrollBottomBtn(true);
        }
      }

      // ONLY process notifications for real-time newly arriving messages (NEVER during historical bootstrap)
      if (!wasInitialLoad) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newMsg = change.doc.data();
            if (newMsg.senderId && newMsg.senderId !== user.id) {
              const msgTime = newMsg.timestamp?.toDate ? newMsg.timestamp.toDate().getTime() : (newMsg.clientTime || 0);
              const isRecent = msgTime > 0 && Math.abs(Date.now() - msgTime) < 30000;
              const isWindowHidden = typeof document !== 'undefined' && document.hidden;
              const isLocked = isAppLockedRef.current;

              if (newMsg.type === 'ping' && isRecent) {
                notifyIncoming({
                  senderName: newMsg.senderName || 'Rekan Kerja',
                  chatName: activeChat.name,
                  isGroup: isGroup,
                  isPing: true
                });
              } else if (isRecent && (isWindowHidden || isLocked)) {
                notifyIncoming({
                  senderName: newMsg.senderName || 'Pesan Baru',
                  chatName: activeChat.name,
                  isGroup: isGroup,
                  messageText: newMsg.text,
                  isPing: false
                });
              }

              // Update message document to track who read it using arrayUnion
              if (!newMsg.readBy?.includes(user.id)) {
                updateDoc(change.doc.ref, {
                  readBy: arrayUnion(user.id),
                  isRead: true,
                  status: 'read'
                }).catch(() => {});
              }
            }
          }
        });
      }

      // Clear unread badge for this user in the chat document
      if (activeChatUnreadFor?.includes(user.id)) {
        updateDoc(doc(db, 'chats', currentChatId), {
          unreadFor: arrayRemove(user.id)
        }).catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [activeChat?.id, activeChat?.type, activeChat?.name, activeChatUnreadFor, user?.id, messagesLimit, loadAllTimeMessages, showToast, notifyIncoming, scrollToBottom]);

  // 6. Track Presence of the Other User in Active Chat (Single Document Listener)
  const otherContactId = (activeChat && activeChat.type !== 'group' && user?.id)
    ? activeChat.participants?.find((id: string) => id !== user.id)
    : null;

  useEffect(() => {
    if (!otherContactId) return;

    const unsubscribe = onSnapshot(doc(db, 'users', otherContactId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setContactPresence({
          isOnline: data.isOnline,
          lastSeen: data.lastSeen
        });
        if (data.photoURL || data.name) {
          setUsersMap(prev => {
            const updated = {
              ...prev,
              [docSnap.id]: { ...(prev[docSnap.id] || {}), id: docSnap.id, ...data } as UserProfile
            };
            try {
              localStorage.setItem('ecp_connect_users_cache', JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }
      }
    });

    return () => unsubscribe();
  }, [otherContactId]);

  const currentContactPresence = otherContactId ? contactPresence : null;

  // Close context menus on document click
  useEffect(() => {
    const handleClickOutside = () => {
      setMessageContextMenu(null);
      setChatContextMenu(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Ping feature: urgent attention call (desktop notification only, 1-min cooldown, no spam)
  const sendPing = useCallback(async () => {
    if (!activeChat || !user || !profile) return;
    
    // 1-minute cooldown check
    if (pingCooldownSeconds > 0) {
      showToast(`Tunggu ${pingCooldownSeconds} detik sebelum mengirim PING lagi.`);
      return;
    }

    try {
      setPingCooldownSeconds(60); // Set 1-minute cooldown
      playSound('ping');
      justSentMessageRef.current = true;
      isNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
      setNewMessagesWhileScrolled(0);
      setTimeout(() => scrollToBottom(true), 50);

      // Create optimistic ping message
      const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      const optimisticPing = {
        id: tempId,
        clientTempId: tempId,
        chatId: activeChat.id,
        type: 'ping',
        text: '🔔 PING!',
        senderId: user.id,
        senderName: profile.name,
        clientTime: Date.now(),
        timestamp: new Date(),
        status: 'sending',
        readBy: [user.id],
        isRead: false
      };
      setOptimisticMessages(prev => [...prev, optimisticPing]);

      const msgRef = doc(collection(db, `chats/${activeChat.id}/messages`));
      const otherUserIds = activeChat.participants?.filter((id: string) => id !== user.id) || [];

      await setDoc(msgRef, {
        type: 'ping',
        text: '🔔 PING!',
        senderId: user.id,
        senderName: profile.name,
        timestamp: serverTimestamp(),
        status: 'sent',
        readBy: [user.id],
        isRead: false,
        clientTempId: tempId
      });

      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: '🔔 PING!',
        lastMessageSender: profile.name,
        lastMessageTime: serverTimestamp(),
        unreadFor: otherUserIds,
        activePing: {
          id: 'ping_' + Date.now(),
          senderId: user.id,
          senderName: profile.name,
          timestamp: Date.now(),
          active: true,
          stoppedBy: null,
          stoppedByName: null
        }
      });

      showToast('🔔 PING terkirim!');
    } catch (err) {
      console.error(err);
      showToast('Gagal mengirim PING');
    }
  }, [activeChat, user, profile, showToast, scrollToBottom, pingCooldownSeconds]);

  // Send Sticker message
  const sendSticker = useCallback(async (stickerUrl: string, caption?: string) => {
    if (!activeChat || !user || !profile) return;
    
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const optimisticSticker = {
      id: tempId,
      clientTempId: tempId,
      chatId: activeChat.id,
      type: 'sticker',
      text: caption || 'Stiker',
      fileData: stickerUrl,
      senderId: user.id,
      senderName: profile.name,
      clientTime: Date.now(),
      timestamp: new Date(),
      status: 'sending',
      readBy: [user.id],
      isRead: false
    };

    setOptimisticMessages(prev => [...prev, optimisticSticker]);
    playSound('send');
    justSentMessageRef.current = true;
    isNearBottomRef.current = true;
    setShowScrollBottomBtn(false);
    setNewMessagesWhileScrolled(0);
    setTimeout(() => scrollToBottom(true), 50);

    try {
      const otherUserIds = activeChat.participants?.filter((id: string) => id !== user.id) || [];
      await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
        type: 'sticker',
        text: caption || 'Stiker',
        fileData: stickerUrl,
        senderId: user.id,
        senderName: profile.name,
        timestamp: serverTimestamp(),
        status: 'sent',
        readBy: [user.id],
        isRead: false,
        clientTempId: tempId
      });

      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: '✨ Stiker',
        lastMessageTime: serverTimestamp(),
        unreadFor: otherUserIds
      });
    } catch (err) {
      console.error('Error sending sticker:', err);
      showToast('Gagal mengirim stiker. Coba lagi.');
    }
  }, [activeChat, user, profile, showToast, scrollToBottom]);

  // Message Reactions Toggle
  const handleToggleReaction = useCallback(async (msg: any, emoji: string) => {
    if (!activeChat || !user) return;
    const currentReactions: Record<string, string[]> = msg.reactions ? { ...msg.reactions } : {};
    const usersForEmoji: string[] = Array.isArray(currentReactions[emoji]) ? [...currentReactions[emoji]] : [];
    const hasReacted = usersForEmoji.includes(user.id);

    const updatedUsers = hasReacted 
      ? usersForEmoji.filter((uid: string) => uid !== user.id)
      : [...usersForEmoji, user.id];

    if (updatedUsers.length === 0) {
      delete currentReactions[emoji];
    } else {
      currentReactions[emoji] = updatedUsers;
    }

    // Local state update for immediate feedback
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: { ...currentReactions } } : m));
    setOptimisticMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: { ...currentReactions } } : m));

    try {
      if (!msg.id.startsWith('temp_')) {
        await updateDoc(doc(db, `chats/${activeChat.id}/messages`, msg.id), {
          reactions: currentReactions
        });
      }
    } catch (err) {
      console.error('Error updating reaction:', err);
    }
  }, [activeChat, user]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (isAppLocked) return;

      const target = e.target as HTMLElement;
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setIsAppLocked(true);
        sessionStorage.setItem('ecp_connect_locked', 'true');
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowChatSearch(prev => !prev);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        if (activeChat) {
          e.preventDefault();
          sendPing();
        }
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setShowDirectoryModal(prev => !prev);
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsCreatingGroup(prev => !prev);
        return;
      }

      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
        return;
      }

      if (e.key === 'Escape') {
        setShowShortcutsModal(false);
        setShowProfileModal(false);
        setShowDirectoryModal(false);
        setShowGroupInfoModal(false);
        setShowChatSearch(false);
        setForwardModalMessage(null);
        setInfoModalMessage(null);
        setShowContactDrawer(false);
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [isAppLocked, activeChat, sendPing, showShortcutsModal, showProfileModal, showDirectoryModal, showGroupInfoModal, showChatSearch, forwardModalMessage, infoModalMessage, showContactDrawer]);

  // Search user by 6-digit code
  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchCode.trim().toUpperCase();
    if (!clean) return;
    if (clean === profile?.code) {
      setSearchError("Tidak dapat mencari atau chat dengan kode diri sendiri.");
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setSearchResult(null);

    try {
      const q = query(collection(db, 'users'), where('code', '==', clean));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setSearchError(`Kode unik "${clean}" tidak ditemukan. Pastikan 6 digit sudah tepat.`);
      } else {
        const foundDoc = snapshot.docs[0];
        setSearchResult({ id: foundDoc.id, ...foundDoc.data() });
      }
    } catch (err) {
      console.error(err);
      setSearchError('Terjadi kesalahan saat mencari kode.');
    } finally {
      setIsSearching(false);
    }
  };

  // Start chat with user
  const startChat = async (targetUser: any) => {
    if (!user || !profile) return;

    const targetId = targetUser.id || targetUser.uid;

    // Check if chat already exists
    const existing = chats.find(c => 
      c.type === 'direct' && c.participants?.includes(targetId)
    );

    if (existing) {
      setActiveChat(existing);
      setSearchCode('');
      setSearchResult(null);
      return;
    }

    try {
      const newChatRef = doc(collection(db, 'chats'));
      const newChatData = {
        type: 'direct',
        participants: [user.id, targetId],
        participantCodes: [profile.code, targetUser.code],
        participantNames: {
          [user.id]: profile.name,
          [targetId]: targetUser.name
        },
        lastMessage: 'Mulai percakapan',
        lastMessageTime: serverTimestamp(),
        unreadFor: []
      };

      await setDoc(newChatRef, newChatData);
      setSearchCode('');
      setSearchResult(null);
      setActiveChat({ id: newChatRef.id, ...newChatData });
    } catch (e) {
      console.error(e);
    }
  };

  // Create Group (direct creation without mandatory members initially)
  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !user || !profile) return;

    setGroupError('');
    setIsSearching(true);

    try {
      const newChatRef = doc(collection(db, 'chats'));
      const newGroupData = {
        type: 'group',
        name: groupName.trim(),
        creatorId: user.id,
        creatorName: profile.name,
        admins: [user.id],
        participants: [user.id],
        participantCodes: [profile.code],
        participantNames: { [user.id]: profile.name },
        joinRequests: [],
        lastMessage: 'Grup dibuat oleh ' + profile.name,
        lastMessageTime: serverTimestamp(),
        createdAt: serverTimestamp(),
        unreadFor: []
      };

      await setDoc(newChatRef, newGroupData);

      setIsCreatingGroup(false);
      setGroupName('');
      setGroupCodes('');
      setActiveChat({ id: newChatRef.id, ...newGroupData });
      showToast('Grup berhasil dibuat! Anggota dapat ditambahkan nanti.');
    } catch (err) {
      console.error(err);
      setGroupError('Gagal membuat grup.');
    } finally {
      setIsSearching(false);
    }
  };

  // Group permission & join request handlers
  const handleRequestJoinGroup = async (groupId: string) => {
    if (!user) return;
    try {
      const groupRef = doc(db, 'chats', groupId);
      await updateDoc(groupRef, {
        joinRequests: arrayUnion(user.id)
      });
      showToast('Permintaan bergabung telah dikirim ke pembuat grup');
    } catch (err) {
      console.error(err);
      showToast('Gagal mengirim permintaan bergabung');
    }
  };

  const handleLeaveGroup = async (chatId: string) => {
    if (!user) return;
    try {
      const groupRef = doc(db, 'chats', chatId);
      await updateDoc(groupRef, {
        participants: arrayRemove(user.id)
      });
      setActiveChat(null);
      setShowGroupInfoModal(false);
      showToast('Anda telah keluar dari grup');
    } catch (err) {
      console.error(err);
      showToast('Gagal keluar dari grup');
    }
  };

  const handleApproveJoinRequest = async (chatId: string, applicantId: string) => {
    try {
      const applicantDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', applicantId)));
      const applicantData = applicantDoc.empty ? null : applicantDoc.docs[0].data();
      const applicantName = applicantData?.name || 'Anggota Baru';
      const applicantCode = applicantData?.code || '------';

      const groupRef = doc(db, 'chats', chatId);
      await updateDoc(groupRef, {
        joinRequests: arrayRemove(applicantId),
        participants: arrayUnion(applicantId),
        [`participantNames.${applicantId}`]: applicantName,
        participantCodes: arrayUnion(applicantCode)
      });
      showToast(`Permintaan ${applicantName} disetujui`);
    } catch (err) {
      console.error(err);
      showToast('Gagal menyetujui permintaan');
    }
  };

  const handleRejectJoinRequest = async (chatId: string, applicantId: string) => {
    try {
      const groupRef = doc(db, 'chats', chatId);
      await updateDoc(groupRef, {
        joinRequests: arrayRemove(applicantId)
      });
      showToast('Permintaan ditolak');
    } catch (err) {
      console.error(err);
      showToast('Gagal menolak permintaan');
    }
  };

  const handleAddMemberToGroup = async (chatId: string, memberId: string, memberName: string, memberCode: string) => {
    try {
      const groupRef = doc(db, 'chats', chatId);
      await updateDoc(groupRef, {
        participants: arrayUnion(memberId),
        [`participantNames.${memberId}`]: memberName,
        participantCodes: arrayUnion(memberCode)
      });
      showToast(`${memberName} ditambahkan ke grup`);
    } catch (err) {
      console.error(err);
      showToast('Gagal menambahkan anggota');
    }
  };

  // Group members for tagging (@)
  const activeGroupMembers = useMemo(() => {
    if (activeChat?.type !== 'group' || !activeChat.participants) return [];
    return activeChat.participants.map((id: string, idx: number) => ({
      id,
      name: activeChat.participantNames?.[id] || `Anggota ${idx + 1}`,
      code: activeChat.participantCodes?.[idx] || ''
    }));
  }, [activeChat]);

  const matchingMentionMembers = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return activeGroupMembers.filter((m: any) => 
      m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q)
    );
  }, [mentionQuery, activeGroupMembers]);

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || val.length;
    setNewMessage(val);
    setMentionCursorPos(pos);

    if (activeChat?.type === 'group') {
      const textBeforeCursor = val.slice(0, pos);
      const lastAt = textBeforeCursor.lastIndexOf('@');
      if (lastAt !== -1 && !textBeforeCursor.slice(lastAt).includes(' ')) {
        setMentionQuery(textBeforeCursor.slice(lastAt + 1));
      } else {
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (name: string) => {
    const textBeforeCursor = newMessage.slice(0, mentionCursorPos);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    if (lastAt !== -1) {
      const prefix = textBeforeCursor.slice(0, lastAt);
      const suffix = newMessage.slice(mentionCursorPos);
      const updated = `${prefix}@${name} ${suffix}`;
      setNewMessage(updated);
      setMentionQuery(null);
    }
  };

  // Prepare attachment for preview modal with caption
  const handleFileSelectedForPreview = useCallback((file: File, customName?: string) => {
    if (!file || !activeChat) return;
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name || customName || '');
    const sizeFormatted = file.size > 1024 * 1024 
      ? (file.size / (1024 * 1024)).toFixed(1) + ' MB' 
      : Math.max(1, Math.round(file.size / 1024)) + ' KB';

    let previewUrl = '';
    try {
      previewUrl = isImage ? URL.createObjectURL(file) : '';
    } catch {
      previewUrl = '';
    }

    setPendingAttachment({
      file,
      previewUrl,
      fileName: customName || file.name || (isImage ? 'gambar.png' : 'dokumen'),
      fileSize: sizeFormatted,
      fileType: file.type || (isImage ? 'image/png' : 'application/octet-stream'),
      isImage,
      caption: newMessage.trim()
    });
    setShowAttachmentModal(true);
  }, [activeChat, newMessage]);

  // Send text message (Instant Optimistic UI without delay)
  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !activeChat || !user || !profile) return;

    const text = newMessage.trim();
    const replyContext = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text || (replyingTo.type === 'image' || replyingTo.fileType?.startsWith('image/') ? `📷 ${replyingTo.fileName || 'Gambar PNG'}` : `📎 ${replyingTo.fileName || 'Lampiran'}`),
      senderName: replyingTo.senderName || 'Rekan'
    } : null;

    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    // Instant local optimistic message
    const optimisticMsg = {
      id: tempId,
      clientTempId: tempId,
      chatId: activeChat.id,
      text,
      senderId: user.id,
      senderName: profile.name || 'User',
      type: 'text',
      timestamp: new Date(),
      clientTime: Date.now(),
      status: 'sending',
      readBy: [user.id],
      isRead: false,
      replyTo: replyContext
    };

    setOptimisticMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');
    setMentionQuery(null);
    setReplyingTo(null);
    setSendingFailed(null);
    setShowEmojiPicker(false);

    playSound('send');
    justSentMessageRef.current = true;
    isNearBottomRef.current = true;
    setShowScrollBottomBtn(false);
    setNewMessagesWhileScrolled(0);
    setTimeout(() => scrollToBottom(true), 50);

    try {
      const otherUserIds = activeChat.participants?.filter((id: string) => id !== user.id) || [];

      await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
        text,
        senderId: user.id,
        senderName: profile.name || 'User',
        type: 'text',
        timestamp: serverTimestamp(),
        status: 'sent',
        readBy: [user.id],
        isRead: false,
        replyTo: replyContext,
        clientTempId: tempId
      });

      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: text,
        lastMessageTime: serverTimestamp(),
        unreadFor: otherUserIds
      });
    } catch (e: any) {
      console.error('Send message error:', e);
      setOptimisticMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      setSendingFailed('Pesan tidak terkirim. Klik untuk mencoba lagi.');
    }
  };

  // Media & File upload handler with caption & optimistic preview
  const uploadAndSendMedia = async (file: File, customName?: string, customCaption?: string) => {
    if (!file || !activeChat || !user || !profile) return;

    setIsUploadingMedia(true);
    const isImageFile = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name || customName || '');
    setUploadingStatus(isImageFile ? 'Mengoptimalkan gambar PNG/foto...' : 'Mempersiapkan dokumen...');

    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const finalCaption = (customCaption !== undefined ? customCaption : newMessage).trim();

    const replyContext = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text || (replyingTo.type === 'image' || replyingTo.fileType?.startsWith('image/') ? `📷 ${replyingTo.fileName || 'Gambar'}` : `📎 ${replyingTo.fileName || 'Lampiran'}`),
      senderName: replyingTo.senderName || 'Rekan'
    } : null;

    let localPreviewUrl = '';
    if (isImageFile) {
      try {
        localPreviewUrl = URL.createObjectURL(file);
      } catch {}
    }

    // Instant optimistic message in chat
    const optimisticMedia = {
      id: tempId,
      clientTempId: tempId,
      chatId: activeChat.id,
      text: finalCaption || (isImageFile ? `📷 ${customName || file.name}` : `Mengirim lampiran: ${customName || file.name}`),
      senderId: user.id,
      senderName: profile.name || 'User',
      type: isImageFile ? 'image' : 'file',
      fileName: customName || file.name,
      fileSize: (file.size / 1024 > 1000 ? (file.size / (1024 * 1024)).toFixed(1) + ' MB' : Math.round(file.size / 1024) + ' KB'),
      fileType: file.type,
      fileData: localPreviewUrl,
      timestamp: new Date(),
      clientTime: Date.now(),
      status: 'sending',
      readBy: [user.id],
      isRead: false,
      replyTo: replyContext
    };

    setOptimisticMessages(prev => [...prev, optimisticMedia]);
    setNewMessage('');
    setReplyingTo(null);
    setShowEmojiPicker(false);

    playSound('send');
    justSentMessageRef.current = true;
    isNearBottomRef.current = true;
    setShowScrollBottomBtn(false);
    setNewMessagesWhileScrolled(0);
    setTimeout(() => scrollToBottom(true), 50);

    try {
      const processed = await processFileForUpload(file, customName);
      setUploadingStatus('Mengirim ke obrolan...');

      const otherUserIds = activeChat.participants?.filter((id: string) => id !== user.id) || [];

      await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
        text: finalCaption || (processed.isImage ? `📷 ${processed.fileName}` : `Mengirim lampiran: ${processed.fileName}`),
        senderId: user.id,
        senderName: profile.name || 'User',
        type: processed.isImage ? 'image' : 'file',
        fileName: processed.fileName,
        fileSize: processed.fileSize,
        fileType: processed.fileType,
        fileData: processed.dataUrl,
        width: processed.width || null,
        height: processed.height || null,
        timestamp: serverTimestamp(),
        status: 'sent',
        readBy: [user.id],
        isRead: false,
        replyTo: replyContext,
        clientTempId: tempId
      });

      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: processed.isImage ? `📷 ${processed.fileName}` : `📎 ${processed.fileName}`,
        lastMessageTime: serverTimestamp(),
        unreadFor: otherUserIds
      });

      showToast(processed.isImage ? 'Gambar PNG berhasil terkirim! 📷' : 'Dokumen berhasil dikirim! 📎');
    } catch (err: any) {
      console.error('Upload error:', err);
      setOptimisticMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      showToast(err.message || 'Gagal mengirim file. Silakan coba lagi.');
    } finally {
      setIsUploadingMedia(false);
      setUploadingStatus(null);
    }
  };

  // File upload input event adapter -> Routes to Preview with Caption
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelectedForPreview(file);
    }
    e.target.value = '';
  };

  // Drag & drop file handler -> Routes to Preview with Caption
  const handleDropFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    handleFileSelectedForPreview(files[0]);
  };

  // Clipboard Paste handler (Single trigger debounced + Caption preview)
  const handlePaste = (e: React.ClipboardEvent) => {
    if (!activeChat) return;
    const now = Date.now();
    if (now - lastPasteTimeRef.current < 600) {
      e.preventDefault();
      return;
    }

    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          e.stopPropagation();
          lastPasteTimeRef.current = now;
          const timeLabel = new Date().toLocaleTimeString('id-ID', { hour12: false }).replace(/:/g, '');
          const customName = `Screenshot_${timeLabel}.png`;
          handleFileSelectedForPreview(file, customName);
          return;
        }
      }
    }
  };

  const handleCancelAttachment = () => {
    if (pendingAttachment?.previewUrl) {
      try {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      } catch {}
    }
    setPendingAttachment(null);
    setShowAttachmentModal(false);
  };

  const handleSendAttachmentWithCaption = (data: PendingAttachmentData) => {
    uploadAndSendMedia(data.file, data.fileName, data.caption);
    handleCancelAttachment();
  };

  // App Lock Handlers
  const lockApp = () => {
    setIsAppLocked(true);
    setUnlockKey('');
    setUnlockError('');
    sessionStorage.setItem('ecp_connect_locked', 'true');
  };

  const unlockApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setUnlockError('');
    setUnlockLoading(true);

    try {
      const key = unlockKey.trim();
      if (!key) {
        throw new Error('Masukkan kode atau kata sandi Anda.');
      }

      // Check against 6-digit code
      if (key.toUpperCase() === profile.code) {
        setIsAppLocked(false);
        sessionStorage.removeItem('ecp_connect_locked');
        return;
      }

      // Check against password
      if (profile.passwordHash) {
        const hash = await hashPassword(key);
        if (hash === profile.passwordHash) {
          setIsAppLocked(false);
          sessionStorage.removeItem('ecp_connect_locked');
          return;
        }
      }

      throw new Error('Kode atau kata sandi tidak cocok. Gunakan kode 6-digit Anda.');
    } catch (err: any) {
      setUnlockError(err.message || 'Gagal membuka layar');
    } finally {
      setUnlockLoading(false);
    }
  };

  // Right Click Context Menu: Message
  const handleMessageContextMenu = (e: React.MouseEvent, msg: any) => {
    e.preventDefault();
    e.stopPropagation();

    // Calculate menu position within viewport
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 260);

    setMessageContextMenu({ x, y, message: msg });
    setChatContextMenu(null);
  };

  // Right Click Context Menu: Chat
  const handleChatContextMenu = (e: React.MouseEvent, chat: any) => {
    e.preventDefault();
    e.stopPropagation();

    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 200);

    setChatContextMenu({ x, y, chat });
    setMessageContextMenu(null);
  };

  // Delete message for everyone
  const handleDeleteForEveryone = async (msg: any) => {
    if (!activeChat || !user) return;
    try {
      await updateDoc(doc(db, `chats/${activeChat.id}/messages`, msg.id), {
        text: '🚫 Pesan ini telah dihapus',
        isDeleted: true,
        fileData: null,
        fileName: null
      });
      showToast('Pesan dihapus untuk semua orang.');
    } catch (e) {
      console.error(e);
    }
  };

  // Delete message for me
  const handleDeleteForMe = async (msg: any) => {
    if (!activeChat || !user) return;
    try {
      await updateDoc(doc(db, `chats/${activeChat.id}/messages`, msg.id), {
        deletedFor: arrayUnion(user.id)
      });
      showToast('Pesan dihapus untuk Anda.');
    } catch (e) {
      console.error(e);
    }
  };

  // Delete entire chat / group
  const handleDeleteChat = async () => {
    if (!activeChat?.id) return;
    const isGroup = activeChat.type === 'group';
    if (!confirm(`Apakah Anda yakin ingin menghapus ${isGroup ? 'grup' : 'obrolan'} ini?`)) return;

    try {
      await deleteDoc(doc(db, 'chats', activeChat.id));
      setActiveChat(null);
      showToast(`${isGroup ? 'Grup' : 'Obrolan'} berhasil dihapus.`);
    } catch (err) {
      console.error(err);
      showToast(`Gagal menghapus ${isGroup ? 'grup' : 'obrolan'}.`);
    }
  };

  // Toggle star message
  const handleToggleStar = async (msg: any) => {
    if (!activeChat || !user) return;
    const isStarred = msg.starredBy?.includes(user.id);
    try {
      await updateDoc(doc(db, `chats/${activeChat.id}/messages`, msg.id), {
        starredBy: isStarred ? [] : arrayUnion(user.id)
      });
      showToast(isStarred ? 'Bintang dihapus' : 'Pesan dibintangi ⭐');
    } catch (e) {
      console.error(e);
    }
  };

  // Forward message to another chat
  const handleForwardMessage = async (targetChat: any) => {
    if (!forwardModalMessage || !user || !profile) return;
    try {
      playSound('send');
      const otherUserIds = targetChat.participants?.filter((id: string) => id !== user.id) || [];

      await addDoc(collection(db, `chats/${targetChat.id}/messages`), {
        text: forwardModalMessage.text || '',
        senderId: user.id,
        senderName: profile.name,
        type: forwardModalMessage.type || 'text',
        fileName: forwardModalMessage.fileName || null,
        fileSize: forwardModalMessage.fileSize || null,
        fileType: forwardModalMessage.fileType || null,
        fileData: forwardModalMessage.fileData || null,
        timestamp: serverTimestamp(),
        status: 'sent',
        readBy: [user.id],
        isRead: false
      });

      await updateDoc(doc(db, 'chats', targetChat.id), {
        lastMessage: forwardModalMessage.text || (forwardModalMessage.type === 'image' ? `📷 ${forwardModalMessage.fileName || 'Gambar PNG'}` : `📎 ${forwardModalMessage.fileName || 'Lampiran'}`),
        lastMessageTime: serverTimestamp(),
        unreadFor: otherUserIds
      });

      setForwardModalMessage(null);
      showToast(`Pesan diteruskan ke ${getChatName(targetChat)}`);
    } catch (e) {
      console.error(e);
      showToast('Gagal meneruskan pesan');
    }
  };

  // Format timestamp
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return new Intl.DateTimeFormat('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }).format(date);
    } catch (e) {
      return '';
    }
  };

  // Format last seen online
  const formatLastSeen = (lastSeen: any) => {
    if (!lastSeen) return 'Terakhir dilihat beberapa saat lalu';
    try {
      const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

      if (diffMinutes < 1) return 'Terakhir dilihat baru saja';
      if (diffMinutes < 60) return `Terakhir dilihat ${diffMinutes} menit yang lalu`;

      const isToday = date.toDateString() === now.toDateString();
      const timeStr = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);

      if (isToday) return `Terakhir dilihat hari ini pukul ${timeStr}`;

      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `Terakhir dilihat kemarin pukul ${timeStr}`;
      }

      return `Terakhir dilihat ${date.toLocaleDateString('id-ID')} pukul ${timeStr}`;
    } catch (e) {
      return 'Offline';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    showToast('Teks berhasil disalin');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getChatName = (chat: any) => {
    if (chat.type === 'group') return chat.name;
    const otherUserId = chat.participants?.find((id: string) => id !== user?.id);
    return chat.participantNames?.[otherUserId] || 'Rekan Kerja';
  };

  const getOtherUserCode = (chat: any) => {
    if (chat.type === 'group') return null;
    const otherIndex = chat.participants?.findIndex((id: string) => id !== user?.id);
    if (otherIndex !== -1 && chat.participantCodes?.[otherIndex]) {
      return chat.participantCodes[otherIndex];
    }
    return null;
  };

  // Render message status tick marks
  const renderMessageStatus = (msg: any) => {
    if (msg.status === 'sending' || msg.id?.startsWith('temp_')) {
      return (
        <span className="inline-flex items-center text-[#8696a0] ml-1" title="Sedang mengirim...">
          <RotateCw className="w-2.5 h-2.5 animate-spin" />
        </span>
      );
    }

    if (msg.status === 'failed') {
      return (
        <span className="inline-flex items-center text-red-500 gap-0.5 ml-1" title="Gagal terkirim. Klik untuk coba lagi.">
          <AlertCircle className="w-3 h-3" />
        </span>
      );
    }

    const isRead = msg.isRead || (activeChat.type === 'direct' && msg.readBy?.length > 1);

    if (isRead) {
      return (
        <span title="Dibaca" className="inline-flex items-center ml-1">
          <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
        </span>
      );
    }

    if (msg.status === 'sent' || msg.status === 'delivered') {
      return (
        <span title="Terkirim / Belum dibaca" className="inline-flex items-center ml-1">
          <CheckCheck className="w-3.5 h-3.5 text-[#8696a0]" />
        </span>
      );
    }

    return (
      <span title="Terkirim" className="inline-flex items-center ml-1">
        <Check className="w-3 h-3 text-[#8696a0]" />
      </span>
    );
  };

  // Render message text with highlighted @mentions
  const renderFormattedText = (text: string) => {
    if (!text) return '';
    const parts = text.split(/(@[A-Za-z0-9_ -]+(?:\s+[A-Za-z0-9_]+)?)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="font-bold text-[#128c7e] bg-[#128c7e]/10 px-1 py-0.5 rounded text-[11px] inline-block mr-0.5">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (!profile) return null;

  // ==========================================
  // FULL SCREEN APP LOCK OVERLAY
  // ==========================================
  if (isAppLocked) {
    return (
      <div className="fixed inset-0 z-50 bg-[#111b21] flex flex-col items-center justify-center p-4 select-none">
        <div className="w-full max-w-sm bg-[#202c33] rounded-3xl p-8 shadow-2xl border border-[#2a3942] text-center">
          <div className="w-20 h-20 rounded-full bg-[#00a884]/20 border-2 border-[#00a884] flex items-center justify-center mx-auto mb-5 text-[#00a884]">
            <Lock className="w-10 h-10" />
          </div>

          <h1 className="text-2xl font-black text-[#e9edef] tracking-tight">ECP Connect Terkunci</h1>
          <p className="text-xs text-[#8696a0] mt-1 mb-6 leading-relaxed">
            Layar dikunci untuk melindungi privasi percakapan internal Anda.
          </p>

          <div className="flex items-center justify-center gap-3 bg-[#111b21] p-3 rounded-2xl border border-[#2a3942] mb-6">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ backgroundColor: profile.avatarColor || '#00a884' }}
            >
              {profile.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="text-left overflow-hidden">
              <p className="text-xs font-bold text-[#e9edef] truncate">{profile.name}</p>
              <p className="text-[11px] font-mono text-[#00a884] font-bold">KODE: {profile.code}</p>
            </div>
          </div>

          {unlockError && (
            <div className="mb-4 p-2.5 bg-red-900/40 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{unlockError}</span>
            </div>
          )}

          <form onSubmit={unlockApp} className="space-y-4">
            <div>
              <input
                type="password"
                required
                value={unlockKey}
                onChange={(e) => setUnlockKey(e.target.value)}
                placeholder="Masukkan Kode 6-Digit / PIN..."
                className="w-full px-4 py-3 bg-[#111b21] border border-[#2a3942] focus:border-[#00a884] rounded-xl text-center text-sm font-mono tracking-widest text-[#e9edef] outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-[#8696a0]"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={unlockLoading}
              className="w-full py-3 bg-[#00a884] hover:bg-[#008f6f] text-[#111b21] font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.99]"
            >
              <Unlock className="w-4 h-4" />
              <span>Buka Kunci Layar</span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#2a3942] flex justify-between items-center text-[11px]">
            <span className="text-[#8696a0]">Lupa sandi?</span>
            <button
              onClick={() => {
                sessionStorage.removeItem('ecp_connect_locked');
                signOutCode();
              }}
              className="text-red-400 hover:underline font-medium"
            >
              Ganti Akun / Keluar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] h-screen w-full bg-[#f0f2f5] font-sans text-[#1c1e21] overflow-hidden select-none relative">
      
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-[#128c7e] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Left Sidebar - WhatsApp Chat List */}
      <aside className={`${activeChat ? 'hidden md:flex' : 'flex'} w-full md:w-[380px] lg:w-[420px] shrink-0 flex-col bg-white border-r border-[#e1e4e8] h-full`}>
        
        {/* User Header & Top Actions */}
        <div className="p-3 bg-[#f0f2f5] flex flex-col border-b border-[#ddd]">
          
          {/* Status Bar */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#e1e4e8] text-[10px] text-[#667781]">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#128c7e] tracking-tight">ECP CONNECT</span>
              <span 
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                  isNetworkOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}
                title={isNetworkOnline ? 'Terhubung ke server' : 'Koneksi lambat / mode offline aktif'}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isNetworkOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                {isNetworkOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {notifPermission !== 'granted' ? (
                <button
                  onClick={requestDesktopNotification}
                  className="text-[#128c7e] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  title="Aktifkan Notifikasi Desktop"
                >
                  <Bell className="w-3 h-3 text-amber-600" />
                  <span>Aktifkan Notifikasi</span>
                </button>
              ) : (
                <button
                  onClick={testDesktopNotification}
                  className="text-[#128c7e] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  title="Uji kirim notifikasi desktop sekarang"
                >
                  <Bell className="w-3 h-3 text-[#25d366]" />
                  <span>Tes Notifikasi</span>
                </button>
              )}
              {firebaseUser?.email && (
                <span className="truncate max-w-[110px] text-[#888]">{firebaseUser.email}</span>
              )}
            </div>
          </div>

          {/* User Profile Bar & Quick Actions */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div 
                onClick={() => setShowProfileModal(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm cursor-pointer relative group overflow-hidden border border-[#ddd] shrink-0"
                style={{ backgroundColor: usersMap[profile.id]?.avatarColor || profile.avatarColor || '#128c7e' }}
                title="Klik untuk mengubah foto profil & pengaturan"
              >
                {(usersMap[profile.id]?.photoURL || profile.photoURL) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img 
                    src={usersMap[profile.id]?.photoURL || profile.photoURL} 
                    alt={profile.name} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  profile.name.substring(0, 2).toUpperCase()
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Settings className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <div className="overflow-hidden min-w-0">
                <p 
                  onClick={() => setShowProfileModal(true)}
                  className="text-xs font-bold truncate leading-tight cursor-pointer hover:text-[#128c7e] transition-colors"
                  title="Klik untuk buka profil"
                >
                  {profile.name}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] font-mono text-[#128c7e] bg-[#d9fdd3] px-1.5 py-0.5 rounded font-black tracking-wider shrink-0">
                    {profile.code}
                  </span>
                  <button 
                    onClick={() => copyToClipboard(profile.code)}
                    className="text-[#667781] hover:text-[#128c7e] p-0.5 transition-colors shrink-0"
                    title="Salin kode unik Anda"
                  >
                    {copiedCode === profile.code ? <Check className="w-3 h-3 text-[#25d366]" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Action Buttons: Directory, Shortcuts, Lock, Settings */}
            <div className="flex items-center gap-1 shrink-0">
              <button 
                onClick={() => setShowDirectoryModal(true)}
                className="px-2 py-1.5 rounded-lg bg-white border border-[#ddd] hover:bg-[#e7f8e8] hover:text-[#128c7e] text-[#54656f] transition-all shadow-xs flex items-center gap-1 text-xs font-semibold"
                title="Buka Direktori Akun & Grup (Alt+D)"
              >
                <Users className="w-3.5 h-3.5 text-[#128c7e]" />
                <span className="text-[11px]">Direktori</span>
              </button>
              <button 
                onClick={() => setShowShortcutsModal(true)}
                className="p-1.5 rounded-lg bg-white border border-[#ddd] hover:bg-[#f0f2f5] text-[#54656f] transition-all shadow-xs"
                title="Pintasan Keyboard (?)"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <button 
                onClick={lockApp}
                className="p-1.5 rounded-lg bg-white border border-[#ddd] hover:bg-[#ffebee] hover:text-red-600 text-[#54656f] transition-all shadow-xs"
                title="Kunci Layar Aplikasi (Ctrl+L)"
              >
                <Lock className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setShowProfileModal(true)}
                className="p-1.5 rounded-lg bg-white border border-[#ddd] hover:bg-[#f0f2f5] text-[#54656f] transition-all shadow-xs"
                title="Profil & Pengaturan Kunci Otomatis"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search bar & Group button */}
          <div className="flex gap-2 relative">
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder="Cari chat obrolan..." 
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="w-full bg-white rounded-lg py-2 pl-9 pr-4 text-xs tracking-wide outline-none border border-[#ddd] focus:border-[#128c7e] transition-colors"
              />
              <Search className="w-4 h-4 text-[#54656f] absolute left-2.5 top-2.5" />
            </div>
            <button 
              onClick={() => { setIsCreatingGroup(!isCreatingGroup); setSearchError(''); }}
              className={`p-2 rounded-lg flex items-center justify-center border transition-all ${isCreatingGroup ? 'bg-[#128c7e] text-white border-[#128c7e]' : 'bg-white text-[#54656f] border-[#ddd] hover:bg-[#f5f6f6]'}`}
              title="Buat Grup Baru (Alt+N)"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Group Creation Dropdown (Direct creation without mandatory members) */}
          {isCreatingGroup && (
            <form onSubmit={createGroup} className="mt-3 p-3 bg-white border border-[#128c7e] rounded-xl shadow-md animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-xs font-bold text-[#128c7e] flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Buat Grup Baru</span>
                </h4>
                <button type="button" onClick={() => setIsCreatingGroup(false)} className="text-xs text-[#999] hover:text-[#333]">✕</button>
              </div>
              <p className="text-[11px] text-[#667781] mb-2 leading-relaxed">
                Buat grup langsung dengan memberi nama. Anggota dapat ditambahkan nanti atau bergabung via tab Direktori Grup.
              </p>
              <input
                type="text"
                placeholder="Nama Grup (cth: Divisi Lapangan)"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                className="w-full px-2.5 py-2 mb-2 bg-[#f0f2f5] border border-slate-200 rounded-lg text-xs outline-none focus:border-[#128c7e] font-semibold text-[#1c1e21]"
                required
                autoFocus
              />
              {groupError && <p className="text-[10px] text-red-500 mb-2">{groupError}</p>}
              <button 
                type="submit"
                disabled={isSearching || !groupName.trim()}
                className="w-full py-2 bg-[#128c7e] hover:bg-[#0f7a6d] text-white text-xs font-bold uppercase rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                {isSearching ? 'Membuat...' : 'Buat Grup Sekarang'}
              </button>
            </form>
          )}

          {searchError && !isCreatingGroup && (
            <div className="text-red-600 text-[11px] mt-2 font-medium bg-red-50 p-2 rounded border border-red-100 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto bg-white divide-y divide-[#f5f5f5]">
          {chats.filter(chat => getChatName(chat).toLowerCase().includes(searchCode.toLowerCase())).map(chat => {
            const isGroup = chat.type === 'group';
            const chatTitle = getChatName(chat);
            const otherCode = getOtherUserCode(chat);
            const isUnread = chat.unreadFor?.includes(user?.id);
            const otherUserId = !isGroup ? chat.participants?.find((id: string) => id !== user?.id) : null;
            const otherUserData = otherUserId ? usersMap[otherUserId] : null;
            const displayPhoto = !isGroup ? otherUserData?.photoURL : null;
            const avatarColor = isGroup ? '#25d366' : (otherUserData?.avatarColor || '#128c7e');

            return (
              <div 
                key={chat.id} 
                onClick={() => setActiveChat(chat)}
                onContextMenu={(e) => handleChatContextMenu(e, chat)}
                className={`flex items-center p-3 gap-3 cursor-pointer hover:bg-[#f5f6f6] transition-colors relative ${activeChat?.id === chat.id ? 'bg-[#ebebeb]' : 'bg-white'}`}
              >
                <div 
                  className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-sm relative overflow-hidden border border-[#ddd]"
                  style={{ backgroundColor: avatarColor }}
                >
                  {displayPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayPhoto} alt={chatTitle} className="w-full h-full object-cover" />
                  ) : isGroup ? (
                    <MessageSquare className="w-5 h-5" />
                  ) : (
                    chatTitle.substring(0, 2).toUpperCase()
                  )}
                </div>
                
                <div className="flex-1 overflow-hidden min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className={`text-sm truncate text-[#1c1e21] ${isUnread ? 'font-black' : 'font-medium'}`}>
                      {chatTitle}
                    </h3>
                    <span className="text-[10px] text-[#667781] whitespace-nowrap ml-2">
                      {formatTime(chat.lastMessageTime)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-[11px] truncate flex-1 ${isUnread ? 'text-[#111b21] font-bold' : 'text-[#667781]'}`}>
                      {otherCode ? <span className="font-mono text-[#128c7e] font-bold mr-1">[{otherCode}]</span> : null}
                      {chat.lastMessage || 'Belum ada pesan'}
                    </p>
                    {(() => {
                      const hasActivePing = chat.activePing?.active && chat.activePing?.senderId !== user?.id;
                      if (hasActivePing) {
                        return (
                          <span className="ml-2 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 shadow-xs animate-pulse flex items-center gap-1">
                            <Radio className="w-2.5 h-2.5" /> PING
                          </span>
                        );
                      }
                      if (isUnread) {
                        return (
                          <span className="ml-2 bg-[#25d366] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 shadow-xs">
                            Baru
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>
            );
          })}

          {chats.length === 0 && (
            <div className="p-8 text-center text-[#999]">
              <div className="w-12 h-12 rounded-full bg-[#f0f2f5] flex items-center justify-center mx-auto mb-3 text-[#128c7e]">
                <UserIcon className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-[#1c1e21]">Belum ada percakapan</p>
              <p className="text-[11px] text-[#888] mt-1 leading-relaxed">
                Minta kode 6-digit rekan kerja Anda, lalu ketik di kolom pencarian di atas untuk memulai chat langsung.
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* 2. Middle Main Chat Area */}
      {activeChat ? (
        <main 
          onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDraggingOver(false); }}
          onDrop={(e) => { e.preventDefault(); setIsDraggingOver(false); handleDropFiles(e.dataTransfer.files); }}
          onPaste={handlePaste}
          className={`${activeChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-[#efeae2] relative min-w-0 overflow-hidden h-full`}
        >
          {/* Drag & Drop Visual Overlay */}
          {isDraggingOver && (
            <div className="absolute inset-4 z-40 bg-[#128c7e]/95 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center text-white border-4 border-dashed border-white shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-150">
              <UploadCloud className="w-16 h-16 mb-2 animate-bounce" />
              <h3 className="text-lg font-bold">Lepaskan File atau Gambar PNG di Sini</h3>
              <p className="text-xs opacity-90">File gambar akan otomatis dioptimalkan dan dikirim ke obrolan ini</p>
            </div>
          )}
          
          {/* Chat Header */}
          <header className="h-[60px] bg-[#f0f2f5] border-b border-[#ddd] flex items-center px-3 md:px-4 justify-between shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              {/* WhatsApp Mobile Back Button */}
              <button
                onClick={() => setActiveChat(null)}
                className="md:hidden p-1.5 -ml-1 text-[#54656f] hover:text-[#128c7e] rounded-full active:bg-[#e1e4e8] transition-colors shrink-0"
                title="Kembali ke daftar pesan"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {(() => {
                const otherUserId = activeChat.type !== 'group' ? activeChat.participants?.find((id: string) => id !== user?.id) : null;
                const otherUserData = otherUserId ? usersMap[otherUserId] : null;
                const headerPhoto = activeChat.type !== 'group' ? otherUserData?.photoURL : null;
                const headerBg = activeChat.type === 'group' ? '#25d366' : (otherUserData?.avatarColor || '#128c7e');

                return (
                  <div 
                    className="flex items-center gap-2.5 cursor-pointer min-w-0"
                    onClick={() => {
                      if (activeChat.type === 'group') {
                        setShowGroupInfoModal(true);
                      } else {
                        setShowContactDrawer(!showContactDrawer);
                      }
                    }}
                    title={activeChat.type === 'group' ? "Klik untuk melihat info & anggota grup" : "Klik untuk melihat info kontak"}
                  >
                    <div 
                      className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0 overflow-hidden border border-[#ddd]"
                      style={{ backgroundColor: headerBg }}
                    >
                      {headerPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={headerPhoto} alt={getChatName(activeChat)} className="w-full h-full object-cover" />
                      ) : activeChat.type === 'group' ? (
                        <MessageSquare className="w-5 h-5" />
                      ) : (
                        getChatName(activeChat).substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-semibold text-[#1c1e21] leading-tight flex items-center gap-1.5 truncate">
                        <span className="truncate">{getChatName(activeChat)}</span>
                        {activeChat.type !== 'group' && (
                          <span className="text-[9px] md:text-[10px] font-mono font-bold text-[#128c7e] bg-[#d9fdd3] px-1.5 py-0.5 rounded shrink-0">
                            {getOtherUserCode(activeChat)}
                          </span>
                        )}
                      </p>

                      {activeChat.type === 'group' ? (
                        <p className="text-[10px] text-[#667781] truncate">
                          {activeChat.participants?.length || 0} Anggota • Ketuk untuk Info Grup
                        </p>
                      ) : (
                        <p className="text-[10px] md:text-[11px] text-[#667781] flex items-center gap-1.5 truncate">
                          {currentContactPresence?.isOnline ? (
                            <span className="text-[#25d366] font-bold flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-[#25d366] animate-pulse" />
                              Online
                            </span>
                          ) : (
                            <span>{formatLastSeen(currentContactPresence?.lastSeen)}</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-1 md:gap-1.5 text-[#54656f] shrink-0">
              {/* PING Button (Emergency/urgent attention call) */}
              <button 
                onClick={sendPing}
                className="px-2 md:px-2.5 py-1.5 bg-[#128c7e] hover:bg-[#0f7a6d] text-white rounded-lg transition-all shadow-xs flex items-center gap-1 text-[11px] font-bold tracking-wide active:scale-95 cursor-pointer"
                title="Kirim Panggilan Cepat PING (Ctrl+P)"
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span className="hidden sm:inline">PING!</span>
              </button>

              {/* Chat Search Toggle Button */}
              <button 
                onClick={() => setShowChatSearch(!showChatSearch)}
                className={`p-1.5 md:p-2 rounded-full transition-colors cursor-pointer ${showChatSearch ? 'bg-[#128c7e] text-white' : 'hover:bg-[#e1e4e8] text-[#54656f]'}`}
                title="Cari Pesan & Filter Tanggal (Ctrl+F)"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Toggle Docked Directory Panel */}
              <button 
                onClick={() => setShowDirectoryModal(!showDirectoryModal)}
                className={`p-1.5 md:p-2 rounded-full transition-colors cursor-pointer ${showDirectoryModal ? 'bg-[#128c7e] text-white' : 'hover:bg-[#e1e4e8] text-[#54656f]'}`}
                title="Buka / Tutup Direktori Karyawan & Grup (Alt+D)"
              >
                <Users className="w-4 h-4" />
              </button>

              {/* Group Info or Contact Drawer */}
              <button 
                onClick={() => {
                  if (activeChat.type === 'group') {
                    setShowGroupInfoModal(true);
                  } else {
                    setShowContactDrawer(!showContactDrawer);
                  }
                }} 
                className="p-1.5 md:p-2 hover:bg-[#e1e4e8] rounded-full transition-colors text-[#54656f]"
                title={activeChat.type === 'group' ? "Info Grup & Anggota" : "Info Kontak"}
              >
                {activeChat.type === 'group' ? <Users className="w-4 h-4 text-[#128c7e]" /> : <Info className="w-4 h-4" />}
              </button>

              {/* Delete Chat */}
              <button 
                onClick={handleDeleteChat}
                className="p-1.5 md:p-2 hover:bg-[#fce4e4] rounded-full transition-colors text-[#ea0038]"
                title={activeChat.type === 'group' ? "Hapus Grup" : "Hapus Obrolan"}
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button 
                onClick={lockApp} 
                className="hidden md:flex p-2 hover:bg-[#e1e4e8] rounded-full transition-colors text-[#54656f]"
                title="Kunci Layar (Ctrl+L)"
              >
                <Lock className="w-4 h-4" />
              </button>

              <button 
                onClick={() => setActiveChat(null)} 
                className="p-1.5 md:p-2 hover:bg-[#e1e4e8] rounded-full transition-colors text-[#54656f]"
                title="Tutup Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* In-Chat Search & Date Range Filter Bar */}
          {showChatSearch && (
            <div className="bg-white border-b border-[#ddd] p-2.5 md:p-3 flex flex-col md:flex-row items-stretch md:items-center gap-2 text-xs shadow-xs z-20 animate-in slide-in-from-top-2 duration-150">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#54656f] absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari kata kunci pesan atau nama file..."
                  value={chatSearchKeyword}
                  onChange={(e) => setChatSearchKeyword(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#f0f2f5] rounded-lg border border-[#e1e4e8] outline-none focus:border-[#128c7e] text-xs"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[#667781] flex items-center gap-0.5">
                    <Calendar className="w-3 h-3" /> Dari:
                  </span>
                  <input
                    type="date"
                    value={chatSearchStartDate}
                    onChange={(e) => setChatSearchStartDate(e.target.value)}
                    className="px-2 py-1 bg-[#f0f2f5] rounded-lg border border-[#e1e4e8] text-[11px] outline-none text-[#1c1e21]"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[#667781]">S/d:</span>
                  <input
                    type="date"
                    value={chatSearchEndDate}
                    onChange={(e) => setChatSearchEndDate(e.target.value)}
                    className="px-2 py-1 bg-[#f0f2f5] rounded-lg border border-[#e1e4e8] text-[11px] outline-none text-[#1c1e21]"
                  />
                </div>

                {(chatSearchKeyword || chatSearchStartDate || chatSearchEndDate) && (
                  <button
                    onClick={() => {
                      setChatSearchKeyword('');
                      setChatSearchStartDate('');
                      setChatSearchEndDate('');
                    }}
                    className="p-1 text-[#667781] hover:text-red-600 rounded-md transition-colors"
                    title="Reset Pencarian"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => setShowChatSearch(false)}
                  className="p-1 text-[#667781] hover:text-[#1c1e21] rounded-md transition-colors"
                  title="Tutup Pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          
          {/* Active Ping Attention Banner with Stop Ping Button for Recipient */}
          {hasActivePingForMe && (
            <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white px-3.5 md:px-4 py-2.5 md:py-3 shadow-md flex items-center justify-between gap-3 border-b border-red-700/30 shrink-0 z-20 transition-all animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 animate-pulse">
                  <Radio className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-wider bg-white/25 px-2 py-0.5 rounded-md">
                      🔔 Panggilan PING Masuk
                    </span>
                    <span className="text-[11px] md:text-xs font-semibold text-white/95 truncate">
                      dari {activePingSenderName}
                    </span>
                  </div>
                  <p className="text-[10px] md:text-[11px] text-white/85 truncate mt-0.5">
                    Pengirim meminta perhatian segera. Klik tombol untuk mengonfirmasi respons dan mematikan sinyal.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStopPingFeedback}
                className="px-3.5 md:px-4 py-1.5 md:py-2 bg-white hover:bg-red-50 text-red-700 font-extrabold text-xs rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer border border-white/60"
                title="Hentikan sinyal PING dan kirim konfirmasi bahwa Anda sudah merespons"
              >
                <BellOff className="w-4 h-4 text-red-600" />
                <span>Stop Ping</span>
              </button>
            </div>
          )}

          {/* Feedback banner for Sender when recipient has stopped the ping */}
          {activeChat.activePing && !activeChat.activePing.active && activeChat.activePing.senderId === user?.id && activeChat.activePing.stoppedByName && (
            <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center justify-between text-[11px] text-emerald-800 shrink-0 z-10 animate-in fade-in duration-150">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>PING Anda telah direspons oleh <strong className="font-bold">{activeChat.activePing.stoppedByName}</strong></span>
              </span>
              <button
                type="button"
                onClick={() => {
                  updateDoc(doc(db, 'chats', activeChat.id), { activePing: null }).catch(() => {});
                  setActiveChat((prev: any) => prev ? { ...prev, activePing: null } : prev);
                }}
                className="text-emerald-700 hover:text-emerald-900 text-[10px] font-bold underline cursor-pointer ml-2"
              >
                Tutup
              </button>
            </div>
          )}
          
          {/* Message Stream */}
          <div 
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="flex-1 p-3 md:p-6 flex flex-col gap-2.5 overflow-y-auto relative"
          >
            {/* Load older messages button if chat has more history */}
            {hasMoreMessages && (
              <div className="flex justify-center my-1">
                <button
                  type="button"
                  onClick={handleLoadOlderMessages}
                  disabled={loadingOlderMessages}
                  className="text-[11px] bg-white/95 hover:bg-white text-[#128c7e] border border-[#e1e4e8] rounded-full px-3.5 py-1.5 shadow-2xs font-semibold flex items-center gap-1.5 transition-all hover:border-[#128c7e] active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Muat pesan riwayat sebelumnya"
                >
                  {loadingOlderMessages ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                  <span>Muat Pesan Sebelumnya (+50)</span>
                </button>
              </div>
            )}

            <div className="self-center bg-white/80 backdrop-blur-xs text-[#54656f] text-[10px] px-3 py-1 rounded-md uppercase tracking-wider font-bold shadow-xs border border-[#e1e4e8]">
              Pesan Terenkripsi Aman • ECP Connect
            </div>

            {(() => {
              const filteredMessages = combinedMessages.filter((msg) => {
                if (chatSearchKeyword.trim()) {
                  const q = chatSearchKeyword.toLowerCase();
                  const textMatch = msg.text?.toLowerCase().includes(q);
                  const fileMatch = msg.fileName?.toLowerCase().includes(q);
                  if (!textMatch && !fileMatch) return false;
                }

                if (chatSearchStartDate) {
                  const msgDate = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
                  const start = new Date(chatSearchStartDate + 'T00:00:00');
                  if (msgDate < start) return false;
                }

                if (chatSearchEndDate) {
                  const msgDate = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
                  const end = new Date(chatSearchEndDate + 'T23:59:59');
                  if (msgDate > end) return false;
                }

                return true;
              });

              if (filteredMessages.length === 0 && (chatSearchKeyword || chatSearchStartDate || chatSearchEndDate)) {
                return (
                  <div className="p-6 text-center text-[#667781]">
                    <Search className="w-8 h-8 mx-auto mb-2 text-[#888]" />
                    <p className="text-xs font-semibold">Tidak ada pesan yang cocok</p>
                    <p className="text-[11px] text-[#999] mt-0.5">Coba sesuaikan kata kunci atau rentang tanggal.</p>
                  </div>
                );
              }

              return filteredMessages.map((msg, idx) => {
                const isMine = msg.senderId === user?.id;
                const senderName = msg.senderName || activeChat.participantNames?.[msg.senderId] || 'Rekan';

                // Hide if deleted for me
                if (msg.deletedFor?.includes(user?.id)) {
                  return null;
                }

                const isHovered = hoveredMessageId === msg.id;

                return (
                  <div 
                    key={msg.id || idx} 
                    className={`flex flex-col group relative ${isMine ? 'items-end' : 'items-start'}`}
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                    onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                  >
                    {activeChat.type === 'group' && !isMine && (
                      <div className="flex items-center gap-1.5 mb-1 ml-1">
                        {usersMap[msg.senderId]?.photoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img 
                            src={usersMap[msg.senderId].photoURL} 
                            alt={senderName} 
                            className="w-4 h-4 rounded-full object-cover border border-[#ddd] shrink-0" 
                          />
                        ) : (
                          <div 
                            className="w-4 h-4 rounded-full text-white text-[8px] font-bold flex items-center justify-center shrink-0"
                            style={{ backgroundColor: usersMap[msg.senderId]?.avatarColor || '#128c7e' }}
                          >
                            {senderName.substring(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="text-[10px] text-[#667781] font-semibold">{senderName}</span>
                      </div>
                    )}
                    
                    <div className="relative flex items-center gap-1 max-w-[90%] md:max-w-[75%]">
                      {/* Floating Quick Reaction Bar (WhatsApp style on hover) */}
                      {isHovered && !msg.isDeleted && (
                        <div 
                          className={`absolute -top-7 ${isMine ? 'right-0' : 'left-0'} z-20 bg-white/95 backdrop-blur-xs shadow-md border border-[#e1e4e8] rounded-full px-2 py-0.5 flex items-center gap-1 animate-in fade-in zoom-in-95 duration-100`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleToggleReaction(msg, emoji)}
                              className="text-xs hover:scale-125 transition-transform p-0.5 cursor-pointer"
                              title={`Beri reaksi ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className={`p-2.5 rounded-xl shadow-xs relative transition-all w-full ${
                        msg.type === 'sticker' 
                          ? 'bg-transparent shadow-none p-0' 
                          : isMine ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'
                      }`}>
                        
                        {/* Quoted reply banner if this message is a reply */}
                        {msg.replyTo && (
                          <div className="mb-2 p-2 bg-black/5 rounded-lg border-l-4 border-[#128c7e] text-xs">
                            <p className="font-bold text-[10px] text-[#128c7e]">{msg.replyTo.senderName}</p>
                            <p className="text-[11px] text-[#555] line-clamp-2 italic">{msg.replyTo.text}</p>
                          </div>
                        )}

                        {/* Deleted message state */}
                        {msg.isDeleted ? (
                          <p className="text-xs italic text-[#888] flex items-center gap-1">
                            <span>{msg.text}</span>
                          </p>
                        ) : msg.type === 'sticker' ? (
                          /* Sticker Message Item */
                          <div className="relative group/sticker my-1 flex flex-col items-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={msg.fileData}
                              alt="Stiker"
                              className="w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-md hover:scale-105 transition-transform cursor-pointer"
                              loading="lazy"
                              onClick={() => {
                                handleSaveCustomSticker(msg.fileData);
                              }}
                              title="Klik untuk simpan ke koleksi stiker"
                            />
                            {msg.text && msg.text !== 'Stiker' && (
                              <p className="text-[11px] text-[#1c1e21] bg-white/80 backdrop-blur-xs px-2 py-0.5 rounded-full mt-1 font-medium shadow-2xs">
                                {msg.text}
                              </p>
                            )}
                          </div>
                        ) : msg.type === 'ping' ? (
                          /* PING Attention Call Item */
                          <div className="flex items-center gap-2.5 py-1 px-1.5 bg-amber-50/80 rounded-lg border border-amber-300/80 text-amber-900">
                            <div className="w-8 h-8 rounded-full bg-amber-400/30 flex items-center justify-center text-amber-700 shrink-0 animate-bounce">
                              <Radio className="w-4 h-4 text-amber-700" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black tracking-wider text-amber-900 flex items-center gap-1">
                                <span>🔔 PING! Panggilan Perhatian</span>
                              </p>
                              <p className="text-[10px] text-amber-700 truncate">
                                {isMine ? 'Anda memanggil perhatian obrolan ini' : `${senderName} memanggil perhatian Anda!`}
                              </p>
                            </div>
                          </div>
                        ) : (msg.type === 'image' || (msg.type === 'file' && (msg.fileType?.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(msg.fileName || '')))) ? (
                          <div className="flex flex-col gap-1.5">
                            {msg.fileData ? (
                              <div 
                                onClick={() => setActiveLightboxImage({
                                  url: msg.fileData,
                                  name: msg.fileName || 'Gambar PNG',
                                  sender: senderName,
                                  time: msg.timestamp,
                                  size: msg.fileSize
                                })}
                                className="relative group/img cursor-pointer overflow-hidden rounded-lg bg-black/5 border border-black/5 max-w-[340px]"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                  src={msg.fileData} 
                                  alt={msg.fileName || 'Gambar'} 
                                  className="w-full max-h-72 object-cover rounded-lg group-hover:scale-[1.01] transition-transform duration-200 block"
                                  loading="lazy"
                                />
                                {/* Hover overlay with quick preview, sticker maker & download */}
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <span className="p-2 bg-white/95 rounded-full text-[#1c1e21] shadow hover:bg-white transition-colors" title="Buka Gambar">
                                    <Eye className="w-4 h-4 text-[#128c7e]" />
                                  </span>
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setStickerMakerInitialImage(msg.fileData);
                                      setShowStickerMaker(true);
                                    }}
                                    className="p-2 bg-white/95 rounded-full text-[#1c1e21] shadow hover:bg-white transition-colors"
                                    title="Jadikan Stiker Lucu ✨"
                                  >
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadDataUrl(msg.fileData, msg.fileName || 'gambar.png');
                                    }}
                                    className="p-2 bg-white/95 rounded-full text-[#1c1e21] shadow hover:bg-white transition-colors"
                                    title="Unduh Gambar"
                                  >
                                    <Download className="w-4 h-4 text-[#128c7e]" />
                                  </button>
                                </div>
                                {/* Name and size bar */}
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2.5 py-1.5 flex items-center justify-between text-white text-[10px]">
                                  <span className="truncate max-w-[200px] font-medium drop-shadow-xs">{msg.fileName}</span>
                                  <span className="font-mono text-[9px] opacity-90 drop-shadow-xs">{msg.fileSize}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-xs">
                                <p className="font-semibold">⚠️ Pratinjau gambar tidak tersedia</p>
                                <p className="text-[10px] text-amber-700">{msg.fileName}</p>
                              </div>
                            )}

                            {/* Caption text if any */}
                            {msg.text && !msg.text.startsWith('Mengirim lampiran:') && !msg.text.startsWith('📷 ') && (
                              <p className="text-xs leading-relaxed text-[#1c1e21] whitespace-pre-wrap break-words px-0.5">
                                {renderFormattedText(msg.text)}
                              </p>
                            )}
                          </div>
                        ) : msg.type === 'file' ? (
                          <div className="flex items-center gap-2.5 bg-[#f0f2f5] p-2.5 rounded-lg border border-[#e1e4e8] mb-1">
                            <div className="bg-[#128c7e] p-2 rounded-lg text-white">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="overflow-hidden min-w-[140px]">
                              <p className="text-xs font-semibold text-[#1c1e21] truncate">{msg.fileName}</p>
                              <p className="text-[10px] text-[#667781]">{msg.fileSize || 'Dokumen'}</p>
                            </div>
                            {msg.fileData && (
                              <button 
                                type="button"
                                onClick={() => downloadDataUrl(msg.fileData, msg.fileName || 'dokumen')}
                                className="p-1.5 text-[#54656f] hover:text-[#128c7e] ml-auto transition-colors"
                                title="Unduh file"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs leading-relaxed text-[#1c1e21] whitespace-pre-wrap break-words">
                            {renderFormattedText(msg.text)}
                          </p>
                        )}

                        {/* Message Footer: Timestamp & Read Status */}
                        <div className="flex flex-col items-end gap-0.5 mt-1">
                          <div className="flex items-center justify-end gap-1 text-[9px] text-[#667781] font-mono">
                            {msg.starredBy?.includes(user?.id) && (
                              <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500 mr-0.5" />
                            )}
                            <span>{formatTime(msg.timestamp)}</span>
                            {isMine && !msg.isDeleted && renderMessageStatus(msg)}
                          </div>
                          
                          {/* Group Message 'Seen By' Indicator */}
                          {isMine && activeChat?.type === 'group' && msg.readBy && msg.readBy.length > 0 && (
                            <div className="flex items-center -space-x-1 mt-0.5 justify-end">
                              {msg.readBy.filter((id: string) => id !== user?.id).slice(0, 5).map((readerId: string) => {
                                const reader = usersMap[readerId];
                                if (!reader) return null;
                                return (
                                  <div 
                                    key={readerId} 
                                    className="w-3.5 h-3.5 rounded-full border border-white flex items-center justify-center text-[6px] font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] overflow-hidden"
                                    style={{ backgroundColor: reader.avatarColor || '#34b7f1' }}
                                    title={`Dibaca oleh ${reader.name}`}
                                  >
                                    {reader.photoURL ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={reader.photoURL} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      reader.name?.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                );
                              })}
                              {msg.readBy.filter((id: string) => id !== user?.id).length > 5 && (
                                <div className="w-3.5 h-3.5 rounded-full border border-white flex items-center justify-center bg-[#f0f2f5] text-[#54656f] text-[6px] font-bold shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                                  +
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Quick right-click trigger icon on hover */}
                        <button
                          onClick={(e) => handleMessageContextMenu(e, msg)}
                          className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 bg-white/70 hover:bg-white rounded-md text-[#54656f] transition-opacity shadow-xs cursor-pointer"
                          title="Menu Opsi Pesan"
                        >
                          <MoreVertical className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Reactions Display Chips */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end pr-1' : 'justify-start pl-1'}`}>
                        {Object.entries(msg.reactions).map(([emoji, uids]: [string, any]) => {
                          if (!Array.isArray(uids) || uids.length === 0) return null;
                          const reactedByMe = uids.includes(user?.id);
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleToggleReaction(msg, emoji)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] shadow-2xs border transition-all cursor-pointer ${
                                reactedByMe
                                  ? 'bg-[#d9fdd3] border-[#25d366] text-[#075e54] font-bold scale-105'
                                  : 'bg-white/90 hover:bg-white border-[#e1e4e8] text-[#1c1e21]'
                              }`}
                              title={`Reaksi ${emoji} (${uids.length})`}
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px] opacity-80">{uids.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            {sendingFailed && (
              <div 
                onClick={() => sendMessage()}
                className="self-center bg-red-50 hover:bg-red-100 text-red-600 text-xs px-3 py-1.5 rounded-lg border border-red-200 cursor-pointer flex items-center gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{sendingFailed}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Floating Scroll to Bottom Button if user is reading older messages */}
          {showScrollBottomBtn && (
            <div className="absolute right-4 md:right-8 bottom-20 z-20 pointer-events-auto">
              <button
                type="button"
                onClick={() => {
                  scrollToBottom(true);
                  isNearBottomRef.current = true;
                  setShowScrollBottomBtn(false);
                  setNewMessagesWhileScrolled(0);
                }}
                className="bg-white/95 hover:bg-white text-[#128c7e] border border-[#e1e4e8] shadow-lg rounded-full px-3.5 py-1.5 flex items-center gap-1.5 transition-all text-xs font-semibold hover:shadow-xl active:scale-95 cursor-pointer backdrop-blur-xs group"
                title="Gulir ke pesan terbaru"
              >
                <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                <span>Pesan Terbaru</span>
                {newMessagesWhileScrolled > 0 && (
                  <span className="bg-[#25d366] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                    {newMessagesWhileScrolled}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Replying To Banner */}
          {replyingTo && (
            <div className="bg-[#f0f2f5] border-t border-[#ddd] px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <CornerUpLeft className="w-4 h-4 text-[#128c7e] shrink-0" />
                <div className="overflow-hidden border-l-2 border-[#128c7e] pl-2">
                  <p className="text-[10px] font-bold text-[#128c7e]">Membalas pesan {replyingTo.senderName}</p>
                  <p className="text-xs text-[#54656f] truncate">{replyingTo.text}</p>
                </div>
              </div>
              <button 
                onClick={() => setReplyingTo(null)}
                className="p-1 text-[#888] hover:text-[#333] rounded-full"
                title="Batal balas"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Member Tagging (@) Auto-Suggest Popup */}
          {mentionQuery !== null && matchingMentionMembers.length > 0 && (
            <div className="absolute bottom-16 inset-x-3 md:inset-x-6 bg-white border border-[#128c7e] rounded-xl shadow-2xl p-1.5 max-h-48 overflow-y-auto z-30 animate-in slide-in-from-bottom-2 duration-150">
              <div className="px-2.5 py-1 text-[10px] font-bold text-[#128c7e] uppercase tracking-wider border-b border-gray-100 flex items-center gap-1">
                <AtSign className="w-3 h-3" />
                <span>Tag Anggota Grup</span>
              </div>
              {matchingMentionMembers.map((member: any) => (
                <div
                  key={member.id}
                  onClick={() => insertMention(member.name)}
                  className="px-2.5 py-2 hover:bg-[#f0f2f5] rounded-lg cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#128c7e]/10 text-[#128c7e] flex items-center justify-center font-bold text-[10px]">
                      {member.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold text-[#1c1e21]">{member.name}</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#128c7e] bg-[#d9fdd3] px-1.5 py-0.5 rounded font-bold">
                    {member.code}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Status pill while uploading/optimizing media */}
          {isUploadingMedia && (
            <div className="bg-[#e7f8e8] border-t border-[#b7ebc0] px-4 py-2 flex items-center justify-between text-xs font-semibold text-[#0f7a6d]">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{uploadingStatus || 'Memproses berkas gambar PNG...'}</span>
              </div>
              <span className="text-[10px] text-[#0f7a6d]/80 font-mono">Mengompresi & Mengirim</span>
            </div>
          )}

          {/* Chat Footer Input */}
          <footer className="bg-[#f0f2f5] px-3 md:px-4 py-2.5 flex items-center gap-2 shrink-0 border-t border-[#ddd] relative">
            <input 
              type="file" 
              ref={imageInputRef} 
              accept="image/png,image/jpeg,image/webp,image/gif,image/*" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="*/*" 
              onChange={handleFileUpload} 
              className="hidden" 
            />

            {/* Emoji & Sticker Picker Popup Button */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-2 rounded-full transition-colors cursor-pointer ${
                  showEmojiPicker 
                    ? 'bg-[#128c7e] text-white' 
                    : 'text-[#54656f] hover:text-[#128c7e] hover:bg-[#e1e4e8]'
                }`}
                title="Emoji & Stiker"
              >
                <Smile className="w-5 h-5" />
              </button>

              {/* Emoji & Sticker Floating Panel */}
              <EmojiStickerPicker
                isOpen={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
                onSelectEmoji={(emoji) => {
                  setNewMessage(prev => prev + emoji);
                }}
                onSelectSticker={(stickerUrl) => {
                  setShowEmojiPicker(false);
                  sendSticker(stickerUrl);
                }}
                customStickers={customStickers}
                onOpenStickerMaker={() => {
                  setShowEmojiPicker(false);
                  setStickerMakerInitialImage(null);
                  setShowStickerMaker(true);
                }}
                onDeleteCustomSticker={handleDeleteCustomSticker}
              />
            </div>
            
            <button 
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploadingMedia}
              className="text-[#54656f] hover:text-[#128c7e] p-2 hover:bg-[#e1e4e8] rounded-full transition-colors disabled:opacity-40 cursor-pointer"
              title="Kirim Foto / Gambar PNG (Screenshot)"
            >
              <LucideImage className="w-5 h-5" />
            </button>

            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingMedia}
              className="text-[#54656f] hover:text-[#128c7e] p-2 hover:bg-[#e1e4e8] rounded-full transition-colors disabled:opacity-40 cursor-pointer"
              title="Lampirkan Dokumen / File Lainnya"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <form onSubmit={sendMessage} className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={newMessage}
                onChange={handleMessageInputChange}
                onPaste={handlePaste}
                placeholder={activeChat.type === 'group' ? "Ketik pesan atau ketik @ untuk tag anggota..." : "Ketik pesan atau tempel gambar..."}
                className="flex-1 bg-white border-none rounded-xl px-4 py-2.5 text-xs outline-none shadow-xs text-[#1c1e21] focus:ring-1 focus:ring-[#128c7e]"
              />
              <button 
                type="submit"
                disabled={!newMessage.trim() || isUploadingMedia}
                className="bg-[#128c7e] p-2.5 rounded-full text-white cursor-pointer hover:bg-[#0f7a6d] transition-colors disabled:opacity-40 disabled:hover:bg-[#128c7e] shadow-sm shrink-0"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
          </footer>
        </main>
      ) : (
        <main className="hidden md:flex flex-1 flex-col items-center justify-center bg-[#efeae2] text-[#54656f] p-8 text-center">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm text-[#128c7e] border border-[#ddd]">
            <Shield className="w-10 h-10 text-[#128c7e]" />
          </div>
          <h2 className="text-2xl font-black text-[#1c1e21] mb-1">ECP Connect</h2>
          <p className="text-xs text-[#54656f] max-w-sm leading-relaxed mb-6">
            Sistem Komunikasi Pesan Instan Internal Perusahaan. Cari kode 6-digit rekan kerja untuk memulai percakapan aman.
          </p>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-xs border border-[#ddd]">
            <Lock className="w-3.5 h-3.5 text-[#128c7e]" />
            <span className="text-[11px] font-semibold text-[#1c1e21]">
              Gunakan tombol gembok di sudut atas untuk mengunci layar saat meninggalkan meja
            </span>
          </div>
        </main>
      )}

      {/* 3. Optional Right Drawer: Contact Info */}
      {showContactDrawer && activeChat && (
        <aside className="w-[300px] shrink-0 bg-white border-l border-[#e1e4e8] flex flex-col">
          <div className="h-[60px] px-4 border-b border-[#ddd] bg-[#f0f2f5] flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#1c1e21]">Info Kontak</h3>
            <button onClick={() => setShowContactDrawer(false)} className="p-1 hover:bg-[#e1e4e8] rounded-full">
              <X className="w-4 h-4 text-[#54656f]" />
            </button>
          </div>

          <div className="p-6 flex flex-col items-center border-b border-[#f0f2f5] text-center">
            {(() => {
              const otherContactData = otherContactId ? usersMap[otherContactId] : null;
              const contactPhoto = otherContactData?.photoURL;
              const contactBg = activeChat.type === 'group' ? '#25d366' : (otherContactData?.avatarColor || '#34b7f1');

              return (
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl mb-3 shadow-md overflow-hidden border border-[#ddd]"
                  style={{ backgroundColor: contactBg }}
                >
                  {contactPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={contactPhoto} alt={getChatName(activeChat)} className="w-full h-full object-cover" />
                  ) : activeChat.type === 'group' ? (
                    <MessageSquare className="w-8 h-8" />
                  ) : (
                    getChatName(activeChat).substring(0, 2).toUpperCase()
                  )}
                </div>
              );
            })()}
            <h4 className="text-sm font-bold text-[#1c1e21]">{getChatName(activeChat)}</h4>
            {activeChat.type !== 'group' && (
              <div className="mt-2 bg-[#f0f2f5] px-3 py-1 rounded-full border border-[#e1e4e8]">
                <span className="text-xs font-mono font-black text-[#128c7e]">
                  KODE: {getOtherUserCode(activeChat)}
                </span>
              </div>
            )}
            <p className="text-[11px] text-[#667781] mt-2">
              {currentContactPresence?.isOnline ? '🟢 Sedang Online' : formatLastSeen(currentContactPresence?.lastSeen)}
            </p>
          </div>

          <div className="p-4 space-y-3">
            <button 
              onClick={() => {
                sendPing();
              }}
              className="w-full py-2.5 px-3 bg-[#128c7e] hover:bg-[#0f7a6d] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.99]"
              title="Kirim PING perhatian langsung"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Kirim PING (Panggilan Perhatian)</span>
            </button>
          </div>
        </aside>
      )}

      {/* ========================================== */}
      {/* WHATSAPP RIGHT-CLICK CONTEXT MENU (MESSAGE) */}
      {/* ========================================== */}
      {messageContextMenu && (
        <div 
          className="fixed z-50 bg-white rounded-xl shadow-xl border border-[#e1e4e8] py-1.5 w-52 text-xs font-medium text-[#1c1e21] animate-in fade-in zoom-in-95 duration-100"
          style={{ top: messageContextMenu.y, left: messageContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Balas */}
          <button
            onClick={() => {
              setReplyingTo(messageContextMenu.message);
              setMessageContextMenu(null);
            }}
            className="w-full px-3.5 py-2 hover:bg-[#f5f6f6] flex items-center gap-2.5 text-left"
          >
            <CornerUpLeft className="w-4 h-4 text-[#128c7e]" />
            <span>Balas Pesan</span>
          </button>

          {/* Salin Teks */}
          {messageContextMenu.message.text && (
            <button
              onClick={() => {
                copyToClipboard(messageContextMenu.message.text);
                setMessageContextMenu(null);
              }}
              className="w-full px-3.5 py-2 hover:bg-[#f5f6f6] flex items-center gap-2.5 text-left"
            >
              <Copy className="w-4 h-4 text-[#54656f]" />
              <span>Salin Teks</span>
            </button>
          )}

          {/* Lihat Gambar Penuh */}
          {(messageContextMenu.message.type === 'image' || messageContextMenu.message.fileType?.startsWith('image/')) && messageContextMenu.message.fileData && (
            <button
              onClick={() => {
                setActiveLightboxImage({
                  url: messageContextMenu.message.fileData,
                  name: messageContextMenu.message.fileName || 'Gambar PNG',
                  sender: messageContextMenu.message.senderName,
                  time: messageContextMenu.message.timestamp,
                  size: messageContextMenu.message.fileSize
                });
                setMessageContextMenu(null);
              }}
              className="w-full px-3.5 py-2 hover:bg-[#f5f6f6] flex items-center gap-2.5 text-left"
            >
              <Eye className="w-4 h-4 text-[#128c7e]" />
              <span>Lihat Gambar Penuh</span>
            </button>
          )}

          {/* Unduh Media/Dokumen */}
          {messageContextMenu.message.fileData && (
            <button
              onClick={() => {
                downloadDataUrl(
                  messageContextMenu.message.fileData, 
                  messageContextMenu.message.fileName || (messageContextMenu.message.type === 'image' ? 'gambar.png' : 'file')
                );
                setMessageContextMenu(null);
              }}
              className="w-full px-3.5 py-2 hover:bg-[#f5f6f6] flex items-center gap-2.5 text-left"
            >
              <Download className="w-4 h-4 text-[#128c7e]" />
              <span>Unduh {messageContextMenu.message.type === 'image' ? 'Gambar (PNG)' : 'File Dokumen'}</span>
            </button>
          )}

          {/* Bintangi Pesan */}
          <button
            onClick={() => {
              handleToggleStar(messageContextMenu.message);
              setMessageContextMenu(null);
            }}
            className="w-full px-3.5 py-2 hover:bg-[#f5f6f6] flex items-center gap-2.5 text-left"
          >
            <Star className="w-4 h-4 text-amber-500" />
            <span>
              {messageContextMenu.message.starredBy?.includes(user?.id) ? 'Hapus Bintang' : 'Bintangi Pesan'}
            </span>
          </button>

          {/* Teruskan */}
          <button
            onClick={() => {
              setForwardModalMessage(messageContextMenu.message);
              setMessageContextMenu(null);
            }}
            className="w-full px-3.5 py-2 hover:bg-[#f5f6f6] flex items-center gap-2.5 text-left"
          >
            <Forward className="w-4 h-4 text-[#54656f]" />
            <span>Teruskan Pesan</span>
          </button>

          {/* Info Pesan */}
          <button
            onClick={() => {
              setInfoModalMessage(messageContextMenu.message);
              setMessageContextMenu(null);
            }}
            className="w-full px-3.5 py-2 hover:bg-[#f5f6f6] flex items-center gap-2.5 text-left"
          >
            <Info className="w-4 h-4 text-[#54656f]" />
            <span>Info Pesan</span>
          </button>

          <div className="my-1 border-t border-[#f0f2f5]" />

          {/* Hapus untuk Saya */}
          <button
            onClick={() => {
              handleDeleteForMe(messageContextMenu.message);
              setMessageContextMenu(null);
            }}
            className="w-full px-3.5 py-2 hover:bg-[#ffebee] text-red-600 flex items-center gap-2.5 text-left"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
            <span>Hapus untuk Saya</span>
          </button>

          {/* Hapus untuk Semua Orang (Only if isMine) */}
          {messageContextMenu.message.senderId === user?.id && !messageContextMenu.message.isDeleted && (
            <button
              onClick={() => {
                handleDeleteForEveryone(messageContextMenu.message);
                setMessageContextMenu(null);
              }}
              className="w-full px-3.5 py-2 hover:bg-[#ffebee] text-red-600 font-semibold flex items-center gap-2.5 text-left"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <span>Hapus untuk Semua</span>
            </button>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* WHATSAPP RIGHT-CLICK CONTEXT MENU (CHAT) */}
      {/* ========================================== */}
      {chatContextMenu && (
        <div 
          className="fixed z-50 bg-white rounded-xl shadow-xl border border-[#e1e4e8] py-1.5 w-48 text-xs font-medium text-[#1c1e21]"
          style={{ top: chatContextMenu.y, left: chatContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setActiveChat(chatContextMenu.chat);
              setChatContextMenu(null);
            }}
            className="w-full px-3.5 py-2 hover:bg-[#f5f6f6] flex items-center gap-2 text-left"
          >
            <MessageSquare className="w-4 h-4 text-[#128c7e]" />
            <span>Buka Chat</span>
          </button>

          <button
            onClick={() => {
              // Toggle unread
              updateDoc(doc(db, 'chats', chatContextMenu.chat.id), {
                unreadFor: arrayUnion(user?.id)
              });
              setChatContextMenu(null);
              showToast('Ditandai sebagai belum dibaca');
            }}
            className="w-full px-3.5 py-2 hover:bg-[#f5f6f6] flex items-center gap-2 text-left"
          >
            <Bell className="w-4 h-4 text-[#54656f]" />
            <span>Tandai Belum Dibaca</span>
          </button>

          {activeChat?.id === chatContextMenu.chat.id && (
            <button
              onClick={() => {
                setActiveChat(null);
                setChatContextMenu(null);
              }}
              className="w-full px-3.5 py-2 hover:bg-[#f5f6f6] flex items-center gap-2 text-left"
            >
              <X className="w-4 h-4 text-[#54656f]" />
              <span>Tutup Chat</span>
            </button>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* INFO PESAN MODAL */}
      {/* ========================================== */}
      {infoModalMessage && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-[#ddd]">
            <div className="flex items-center justify-between pb-3 border-b border-[#eee] mb-4">
              <h3 className="text-sm font-bold text-[#1c1e21] flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#128c7e]" />
                <span>Info Pesan</span>
              </h3>
              <button onClick={() => setInfoModalMessage(null)} className="text-[#888] hover:text-[#333]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#f0f2f5] rounded-xl">
                <p className="text-[10px] text-[#667781] uppercase font-bold">Isi Pesan</p>
                <p className="text-xs text-[#1c1e21] mt-1 font-medium">{infoModalMessage.text || 'Lampiran File'}</p>
              </div>

              <div className="flex items-center justify-between p-3 border border-[#eee] rounded-xl">
                <div className="flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-[#53bdeb]" />
                  <span>Status Dibaca</span>
                </div>
                <span className="font-semibold text-[11px] text-[#128c7e]">
                  {infoModalMessage.isRead ? 'Telah Dibaca' : 'Belum Dibaca'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 border border-[#eee] rounded-xl">
                <div className="flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-[#8696a0]" />
                  <span>Waktu Terkirim</span>
                </div>
                <span className="font-mono text-[11px] text-[#555]">
                  {formatTime(infoModalMessage.timestamp)}
                </span>
              </div>
            </div>

            <button 
              onClick={() => setInfoModalMessage(null)}
              className="w-full mt-4 py-2 bg-[#128c7e] text-white font-semibold rounded-xl text-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* FORWARD MESSAGE MODAL */}
      {/* ========================================== */}
      {forwardModalMessage && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-[#ddd]">
            <div className="flex items-center justify-between pb-3 border-b border-[#eee] mb-4">
              <h3 className="text-sm font-bold text-[#1c1e21] flex items-center gap-1.5">
                <Forward className="w-4 h-4 text-[#128c7e]" />
                <span>Teruskan Pesan Ke...</span>
              </h3>
              <button onClick={() => setForwardModalMessage(null)} className="text-[#888] hover:text-[#333]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {chats.map(c => (
                <div
                  key={c.id}
                  onClick={() => handleForwardMessage(c)}
                  className="p-2.5 rounded-xl border border-[#eee] hover:border-[#128c7e] hover:bg-[#d9fdd3]/30 cursor-pointer flex items-center justify-between transition-all"
                >
                  <span className="text-xs font-semibold text-[#1c1e21]">{getChatName(c)}</span>
                  <Forward className="w-3.5 h-3.5 text-[#128c7e]" />
                </div>
              ))}
            </div>

            <button 
              onClick={() => setForwardModalMessage(null)}
              className="w-full mt-4 py-2 bg-[#f0f2f5] text-[#555] font-semibold rounded-xl text-xs"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* IMAGE LIGHTBOX MODAL (PNG VIEWER) */}
      {/* ========================================== */}
      {activeLightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col justify-between animate-in fade-in duration-150 select-none"
          onClick={() => {
            setActiveLightboxImage(null);
            setLightboxZoomed(false);
          }}
        >
          {/* Lightbox Header */}
          <div 
            className="h-16 px-6 bg-black/50 backdrop-blur-md flex items-center justify-between text-white shrink-0 border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="bg-[#128c7e] p-2 rounded-lg text-white">
                <LucideImage className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h3 className="text-sm font-semibold truncate text-white max-w-md">
                  {activeLightboxImage.name}
                </h3>
                <p className="text-xs text-white/70">
                  {activeLightboxImage.sender ? `Dikirim oleh ${activeLightboxImage.sender}` : ''} {activeLightboxImage.size ? `• ${activeLightboxImage.size}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setLightboxZoomed(!lightboxZoomed)}
                className="px-3 py-1.5 hover:bg-white/15 rounded-lg text-white/90 hover:text-white transition-colors flex items-center gap-1.5 text-xs"
                title={lightboxZoomed ? "Ukuran Normal" : "Perbesar Gambar"}
              >
                {lightboxZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
                <span>{lightboxZoomed ? 'Ukuran Normal' : 'Perbesar'}</span>
              </button>

              <button
                type="button"
                onClick={() => downloadDataUrl(activeLightboxImage.url, activeLightboxImage.name)}
                className="px-3 py-1.5 bg-[#128c7e] hover:bg-[#0f7a6d] text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm"
                title="Unduh File Gambar"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Gambar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveLightboxImage(null);
                  setLightboxZoomed(false);
                }}
                className="p-2 hover:bg-white/15 rounded-lg text-white/80 hover:text-white transition-colors ml-2"
                title="Tutup (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Body */}
          <div 
            className="flex-1 flex items-center justify-center p-4 overflow-auto cursor-default"
            onClick={() => {
              setActiveLightboxImage(null);
              setLightboxZoomed(false);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeLightboxImage.url}
              alt={activeLightboxImage.name}
              onClick={(e) => {
                e.stopPropagation();
                setLightboxZoomed(!lightboxZoomed);
              }}
              className={`rounded-md shadow-2xl transition-all duration-200 object-contain max-h-[85vh] ${
                lightboxZoomed ? 'scale-150 cursor-zoom-out' : 'max-w-[90vw] cursor-zoom-in'
              }`}
            />
          </div>

          {/* Lightbox Footer */}
          <div 
            className="h-10 px-6 bg-black/40 flex items-center justify-center text-white/60 text-xs shrink-0 border-t border-white/5 font-mono"
            onClick={(e) => e.stopPropagation()}
          >
            Tekan ESC atau klik area luar untuk menutup pratinjau • Klik gambar untuk zoom
          </div>
        </div>
      )}

      {/* Directory Modal (User Directory & Public Groups Tab) */}
      <DirectoryModal
        isOpen={showDirectoryModal}
        onClose={() => setShowDirectoryModal(false)}
        currentUser={(profile || user) as any}
        currentProfile={(profile || user) as any}
        usersMap={usersMap}
        onStartDirectChat={(targetUser) => {
          setShowDirectoryModal(false);
          startChat(targetUser);
        }}
        onOpenGroupChat={(group) => {
          setShowDirectoryModal(false);
          setActiveChat(group);
        }}
        showToast={showToast}
      />

      {/* Floating Edge Tab to easily slide open directory when hidden */}
      {!showDirectoryModal && (
        <button
          onClick={() => setShowDirectoryModal(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-[#128c7e] hover:bg-[#0f7a6d] text-white shadow-md rounded-l-xl py-3 px-1.5 flex flex-col items-center gap-1.5 transition-all duration-200 group border border-r-0 border-white/20 active:scale-95 cursor-pointer"
          title="Buka Direktori Karyawan & Grup (Alt+D)"
        >
          <Users className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span className="text-[8px] font-extrabold tracking-widest [writing-mode:vertical-lr] rotate-180">
            DIREKTORI
          </span>
        </button>
      )}

      {/* Group Info & Member Management Modal */}
      {activeChat?.type === 'group' && profile && (
        <GroupInfoModal
          isOpen={showGroupInfoModal}
          onClose={() => setShowGroupInfoModal(false)}
          activeChat={chats.find(c => c.id === activeChat.id) || activeChat}
          user={profile}
          profile={profile}
          showToast={showToast}
          usersMap={usersMap}
          onLeaveGroup={() => {
            handleLeaveGroup(activeChat.id);
          }}
        />
      )}

      {/* User Profile & Avatar Change Modal */}
      {profile && (
        <UserProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          profile={profile}
          autoLockMinutes={autoLockMinutes}
          onProfileUpdated={(updated) => {
            if (updated.photoURL) {
              setUsersMap(prev => ({
                ...prev,
                [profile.id]: {
                  ...(prev[profile.id] || profile),
                  photoURL: updated.photoURL
                }
              }));
            }
          }}
          onUpdateAutoLock={(min) => {
            setAutoLockMinutes(min);
            localStorage.setItem('ecp_connect_autolock', min.toString());
            showToast(`Kunci layar otomatis diset ke ${min === 0 ? 'Mati' : `${min} menit`}`);
          }}
          onLockNow={() => {
            setShowProfileModal(false);
            setIsAppLocked(true);
            sessionStorage.setItem('ecp_connect_locked', 'true');
          }}
          onSignOutCode={signOutCode}
          showToast={showToast}
        />
      )}

      {/* Keyboard Shortcuts Reference Modal */}
      <ShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      {/* Attachment Preview Modal with Caption (WhatsApp Style) */}
      <AttachmentPreviewModal
        attachment={pendingAttachment}
        isOpen={Boolean(pendingAttachment && showAttachmentModal)}
        onClose={handleCancelAttachment}
        onSend={handleSendAttachmentWithCaption}
        onOpenStickerMaker={(file) => {
          handleCancelAttachment();
          setStickerMakerInitialImage(file);
          setShowStickerMaker(true);
        }}
      />

      {/* Sticker Maker Modal (Create/Edit Sticker with Text, Draw, Crop) */}
      <StickerMakerModal
        isOpen={showStickerMaker}
        onClose={() => {
          setShowStickerMaker(false);
          setStickerMakerInitialImage(null);
        }}
        initialImage={stickerMakerInitialImage}
        onSendSticker={(stickerDataUrl, caption) => {
          handleSaveCustomSticker(stickerDataUrl);
          sendSticker(stickerDataUrl, caption);
          setShowStickerMaker(false);
        }}
        onSaveToCollection={(stickerDataUrl) => {
          handleSaveCustomSticker(stickerDataUrl);
          showToast('Stiker berhasil disimpan ke koleksi!');
        }}
      />

    </div>
  );
}
