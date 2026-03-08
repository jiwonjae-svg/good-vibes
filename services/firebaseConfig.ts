import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  Auth,
  Persistence,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  getDoc,
  Firestore,
  memoryLocalCache,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_CONFIG } from '../constants/config';
import { appLog } from './logger';
import type { CrawledQuote } from '../data/quotes';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

/**
 * AsyncStorage-backed persistence for Firebase Auth.
 * Replaces the removed getReactNativePersistence from firebase/auth (dropped in v12).
 */
const asyncStoragePersistence = {
  type: 'LOCAL' as const,
  async _isAvailable() {
    return true;
  },
  async _set(key: string, value: unknown) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async _get(key: string) {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  },
  async _remove(key: string) {
    await AsyncStorage.removeItem(key);
  },
  _addListener() {},
  _removeListener() {},
} as unknown as Persistence;

function isConfigured(): boolean {
  return (
    FIREBASE_CONFIG.apiKey !== 'YOUR_FIREBASE_API_KEY' &&
    FIREBASE_CONFIG.projectId !== 'YOUR_PROJECT_ID' &&
    FIREBASE_CONFIG.apiKey !== '' &&
    FIREBASE_CONFIG.projectId !== ''
  );
}

export function initFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore } | null {
  const LOG = '[firebaseConfig.initFirebase]';

  if (!isConfigured()) {
    appLog.warn(`${LOG} Firebase not configured. apiKey=${FIREBASE_CONFIG.apiKey ? '***' : '(empty)'}, projectId=${FIREBASE_CONFIG.projectId || '(empty)'}`);
    return null;
  }
  appLog.log(`${LOG} Config OK: projectId=${FIREBASE_CONFIG.projectId}, authDomain=${FIREBASE_CONFIG.authDomain}`);

  try {
    if (getApps().length === 0) {
      app = initializeApp(FIREBASE_CONFIG);

      auth = initializeAuth(app, {
        persistence: asyncStoragePersistence,
      });

      db = initializeFirestore(app, {
        localCache: memoryLocalCache(),
      });
    } else {
      app = getApp();

      try {
        auth = getAuth(app);
      } catch {
        auth = initializeAuth(app, {
          persistence: asyncStoragePersistence,
        });
      }

      try {
        db = getFirestore(app);
      } catch {
        db = initializeFirestore(app, {
          localCache: memoryLocalCache(),
        });
      }
    }

    appLog.log(`${LOG} Initialized successfully`);
    return { app, auth, db };
  } catch (e) {
    appLog.error(`${LOG} Failed to initialize`, e);
    return null;
  }
}

export function getFirebaseAuth(): Auth | null {
  if (auth) return auth;
  const result = initFirebase();
  const a = result?.auth ?? null;
  if (!a) appLog.warn('[firebaseConfig.getFirebaseAuth] Returning null');
  return a;
}

export function getDb(): Firestore | null {
  if (db) return db;
  const result = initFirebase();
  return result?.db ?? null;
}

/**
 * Loads server quotes stored in chunks from the Firestore `quotes_catalog` collection.
 * Returns an empty array when offline or Firebase is not configured.
 */
export async function fetchServerQuotesFromFirestore(): Promise<CrawledQuote[]> {
  const firestore = getDb();
  if (!firestore) return [];
  try {
    const col = collection(firestore, 'quotes_catalog');

    // Read chunk count from the metadata document
    const metaSnap = await getDoc(doc(col, '_meta'));
    if (!metaSnap.exists()) return [];
    const { chunkCount } = metaSnap.data() as { chunkCount: number };

    // Load all chunks in parallel
    const chunkPromises = Array.from({ length: chunkCount }, (_, i) =>
      getDoc(doc(col, `chunk_${i}`))
    );
    const chunkSnaps = await Promise.all(chunkPromises);

    const quotes: CrawledQuote[] = [];
    for (const snap of chunkSnaps) {
      if (snap.exists()) {
        const data = snap.data() as { quotes: CrawledQuote[] };
        quotes.push(...data.quotes);
      }
    }
    appLog.log(`[firebaseConfig] Loaded ${quotes.length} server quotes from Firestore`);
    return quotes;
  } catch (e) {
    appLog.warn('[firebaseConfig] fetchServerQuotes failed (offline?)', e);
    return [];
  }
}
