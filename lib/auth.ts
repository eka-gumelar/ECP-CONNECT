import { auth, db, googleProvider } from './firebase';
import { 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  serverTimestamp, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc
} from 'firebase/firestore';

export interface UserProfile {
  id: string;
  name: string;
  code: string;
  role?: string;
  passwordHash?: string;
  avatarColor?: string;
  photoURL?: string;
  createdAt: any;
  status?: string;
  isOnline?: boolean;
  lastSeen?: any;
}

const AUTH_STORAGE_KEY = 'ecp_connect_active_user_id';

// Helper to hash password using Web Crypto API
export const hashPassword = async (password: string): Promise<string> => {
  if (!password) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Helper to generate a 6 digit alphanumeric code
export const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid easily confused chars (I, O, 0, 1)
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const AVATAR_COLORS = [
  '#128c7e', '#34b7f1', '#25d366', '#ff5a5a', '#7c3aed', '#f59e0b', '#06b6d4', '#ec4899'
];

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
};

export const signOutGoogle = async () => {
  await firebaseSignOut(auth);
  await signOutActiveProfile();
};

export const signUp = async (
  name: string, 
  password?: string
): Promise<{ user: UserProfile; code: string }> => {
  let code = '';
  let isUnique = false;
  let attempts = 0;
  
  // Find a unique 6-digit code
  while (!isUnique && attempts < 10) {
    attempts++;
    code = generateCode();
    const q = query(collection(db, 'users'), where('code', '==', code));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      isUnique = true;
    }
  }

  const passwordHash = password ? await hashPassword(password) : '';
  const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  
  const newUserRef = doc(collection(db, 'users'));
  const userProfile: UserProfile = {
    id: newUserRef.id,
    name: name.trim(),
    code,
    passwordHash,
    avatarColor: randomColor,
    status: 'online',
    isOnline: true,
    lastSeen: serverTimestamp(),
    createdAt: serverTimestamp()
  };

  await setDoc(newUserRef, userProfile);
  
  // Automatically select this newly created profile
  setActiveUserId(newUserRef.id);
  
  return { user: userProfile, code };
};

export const signInWithCode = async (code: string, password?: string): Promise<UserProfile> => {
  const formattedCode = code.trim().toUpperCase();
  const q = query(collection(db, 'users'), where('code', '==', formattedCode));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error('Kode unik tidak ditemukan. Pastikan 6 digit kode benar.');
  }

  const userDoc = snapshot.docs[0];
  const userData = userDoc.data() as UserProfile;
  userData.id = userDoc.id;

  if (userData.passwordHash && password) {
    const passwordHash = await hashPassword(password);
    if (userData.passwordHash !== passwordHash) {
      throw new Error('Kata sandi salah. Silakan coba lagi.');
    }
  }

  setActiveUserId(userDoc.id);

  try {
    await updateDoc(doc(db, 'users', userDoc.id), {
      status: 'online',
      isOnline: true,
      lastSeen: serverTimestamp()
    });
  } catch (err) {
    console.error('Error updating status', err);
  }

  return userData;
};

let lastPresenceUpdate = 0;
let lastPresenceState: boolean | null = null;

export const updateUserPresence = async (userId: string, isOnline: boolean) => {
  if (!userId) return;
  const now = Date.now();
  // Quota optimization: Only write if state changed (online <-> offline)
  // or if at least 3 minutes (180,000 ms) have passed since last write
  if (lastPresenceState === isOnline && (now - lastPresenceUpdate < 180000)) {
    return;
  }
  lastPresenceUpdate = now;
  lastPresenceState = isOnline;

  try {
    await updateDoc(doc(db, 'users', userId), {
      status: isOnline ? 'online' : 'offline',
      isOnline,
      lastSeen: serverTimestamp()
    });
  } catch {
    // Ignore transient network errors
  }
};

export const setActiveUserId = (userId: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_STORAGE_KEY, userId);
    window.dispatchEvent(new Event('auth-state-change'));
  }
};

export const signOutActiveProfile = async () => {
  if (typeof window !== 'undefined') {
    const currentId = localStorage.getItem(AUTH_STORAGE_KEY);
    if (currentId) {
      try {
        await updateDoc(doc(db, 'users', currentId), {
          status: 'offline',
          isOnline: false,
          lastSeen: serverTimestamp()
        });
      } catch (e) {
        // ignore
      }
    }
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new Event('auth-state-change'));
  }
};

export const getStoredUserId = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(AUTH_STORAGE_KEY);
  }
  return null;
};

export const updateUserProfilePhoto = async (userId: string, photoURL: string) => {
  if (!userId) return;
  try {
    await updateDoc(doc(db, 'users', userId), {
      photoURL,
      lastSeen: serverTimestamp()
    });
  } catch (e) {
    console.error('Error updating profile photo', e);
    throw e;
  }
};



