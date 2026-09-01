'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
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
      const storedId = getStoredUserId();
      syncProfile(storedId);
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (fUser) => {
      setFirebaseUser(fUser);
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
    return await signInWithGoogle();
  };

  const signOutGoogleAuth = async () => {
    await signOutGoogle();
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
        signOutGoogleAuth,
        switchProfile,
        signOutCode
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


