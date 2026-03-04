import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Firestore,
  memoryLocalCache,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_CONFIG } from '../constants/config';
import { appLog } from './logger';
import type { Quote } from '../stores/useQuoteStore';
import type { GrassDay } from '../stores/useGrassStore';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

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
        persistence: getReactNativePersistence(AsyncStorage),
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
          persistence: getReactNativePersistence(AsyncStorage),
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

export async function saveQuotesToFirestore(quotes: Quote[]): Promise<void> {
  const firestore = getDb();
  if (!firestore) return;
  try {
    const col = collection(firestore, 'quotes');
    for (const q of quotes) {
      await addDoc(col, {
        text: q.text,
        author: q.author,
        gradientIndex: q.gradientIndex,
        createdAt: q.createdAt,
      });
    }
  } catch {
    // offline or unconfigured — silent
  }
}

export async function loadQuotesFromFirestore(
  count: number
): Promise<Quote[]> {
  const firestore = getDb();
  if (!firestore) return [];
  try {
    const col = collection(firestore, 'quotes');
    const q = query(col, orderBy('createdAt', 'desc'), limit(count));
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({
      id: doc.id,
      text: doc.data().text,
      author: doc.data().author,
      gradientIndex: doc.data().gradientIndex ?? 0,
      createdAt: doc.data().createdAt ?? Date.now(),
    }));
  } catch {
    return [];
  }
}

export async function saveGrassDayToFirestore(day: GrassDay): Promise<void> {
  const firestore = getDb();
  if (!firestore) return;
  try {
    const col = collection(firestore, 'grass');
    await addDoc(col, day);
  } catch {
    // silent
  }
}
