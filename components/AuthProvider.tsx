'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signInAnonymously, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { 
  UserProfile, 
  getStoredUserId, 
  signInWithGoogle, 
  signOutGoogle, 
  signOutActiveProfile,
  setActiveUserId 
} from '@/lib/auth';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: UserProfile | null;
  profile: UserProfile | null;
  loading: boolean;
  signInGoogle: () => Promise<FirebaseUser>;
  signInGuest: () => Promise<FirebaseUser>;
  signOutGoogleAuth: () => Promise<void>;
  switchProfile: (userId: string) => void;
  signOutCode: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  user: null,
  profile: null,
  loading: true,
  signInGoogle: async () => { throw new Error('Not implemented'); },
  signInGuest: async () => { throw new Error('Not implemented'); },
  signOutGoogleAuth: async () => {},
  switchProfile: () => {},
  signOutCode: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const checkGuestAuth = (): FirebaseUser | null => {
      if (typeof window !== 'undefined') {
        const rawGuest = localStorage.getItem('ecp_guest_auth');
        if (rawGuest) {
          try {
            return JSON.parse(rawGuest) as FirebaseUser;
          } catch {
            return null;
          }
        }
      }
      return null;
    };

    const syncProfile = (uid: string | null) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (!uid) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const docRef = doc(db, 'users', uid);
      unsubscribeDoc = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          data.id = docSnap.id;
          setProfile(data);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }, (error) => {
        console.error("Profile listen error:", error);
        setProfile(null);
        setLoading(false);
      });
    };

    const handleAuthEvent = () => {
      if (!auth.currentUser) {
        const guest = checkGuestAuth();
        if (guest) setFirebaseUser(guest);
      }
      const storedId = getStoredUserId();
      syncProfile(storedId);
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (fUser) => {
      if (fUser) {
        setFirebaseUser(fUser);
      } else {
        const guest = checkGuestAuth();
        setFirebaseUser(guest);
      }
      const storedId = getStoredUserId();
      syncProfile(storedId);
    });

    window.addEventListener('auth-state-change', handleAuthEvent);
    window.addEventListener('storage', handleAuthEvent);

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
      window.removeEventListener('auth-state-change', handleAuthEvent);
      window.removeEventListener('storage', handleAuthEvent);
    };
  }, []);

  const signInGoogle = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ecp_guest_auth');
    }
    return await signInWithGoogle();
  };

  const signInGuest = async (): Promise<FirebaseUser> => {
    try {
      const userCred = await signInAnonymously(auth);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ecp_guest_auth');
      }
      setFirebaseUser(userCred.user);
      return userCred.user;
    } catch (err) {
      console.warn('Firebase anonymous auth not enabled or failed, using local guest session:', err);
      const guestId = 'guest_' + Math.random().toString(36).substring(2, 9);
      const guestUser = {
        uid: guestId,
        displayName: 'Tamu (Guest)',
        email: 'tamu@ecp-connect.local',
        isAnonymous: true,
      } as unknown as FirebaseUser;

      if (typeof window !== 'undefined') {
        localStorage.setItem('ecp_guest_auth', JSON.stringify({
          uid: guestUser.uid,
          displayName: guestUser.displayName,
          email: guestUser.email,
          isAnonymous: true
        }));
        window.dispatchEvent(new Event('auth-state-change'));
      }
      setFirebaseUser(guestUser);
      return guestUser;
    }
  };

  const signOutGoogleAuth = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ecp_guest_auth');
    }
    await signOutGoogle();
    setFirebaseUser(null);
  };

  const switchProfile = (userId: string) => {
    setActiveUserId(userId);
  };

  const signOutCode = async () => {
    await signOutActiveProfile();
  };

  return (
    <AuthContext.Provider 
      value={{ 
        firebaseUser, 
        user: profile, 
        profile, 
        loading,
        signInGoogle,
        signInGuest,
        signOutGoogleAuth,
        switchProfile,
        signOutCode
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


