import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import rawConfig from '../firebase-applet-config.json';

const firebaseConfig = rawConfig as Record<string, any>;

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore with IndexedDB Multi-Tab persistent cache and auto-detect long polling
let firestoreDb;
const customDbId = firebaseConfig.firestoreDatabaseId || undefined;

if (typeof window !== 'undefined') {
  try {
    firestoreDb = customDbId 
      ? initializeFirestore(
          app,
          {
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager()
            }),
            experimentalAutoDetectLongPolling: true
          },
          customDbId
        )
      : initializeFirestore(
          app,
          {
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager()
            }),
            experimentalAutoDetectLongPolling: true
          }
        );
  } catch {
    try {
      firestoreDb = customDbId
        ? initializeFirestore(
            app,
            {
              experimentalAutoDetectLongPolling: true
            },
            customDbId
          )
        : initializeFirestore(
            app,
            {
              experimentalAutoDetectLongPolling: true
            }
          );
    } catch {
      firestoreDb = customDbId 
        ? getFirestore(app, customDbId)
        : getFirestore(app);
    }
  }
} else {
  firestoreDb = customDbId 
    ? getFirestore(app, customDbId)
    : getFirestore(app);
}

export const db = firestoreDb;

if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}
