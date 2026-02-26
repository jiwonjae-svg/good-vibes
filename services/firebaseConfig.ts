import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Firestore,
} from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../constants/config';
import type { Quote } from '../stores/useQuoteStore';
import type { GrassDay } from '../stores/useGrassStore';

let db: Firestore | null = null;

function isConfigured(): boolean {
  return (
    FIREBASE_CONFIG.apiKey !== 'YOUR_FIREBASE_API_KEY' &&
    FIREBASE_CONFIG.projectId !== 'YOUR_PROJECT_ID'
  );
}

export function initFirebase(): Firestore | null {
  if (!isConfigured()) return null;

  try {
    const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
    return db;
  } catch {
    try {
      const app = getApp();
      db = getFirestore(app);
      return db;
    } catch {
      return null;
    }
  }
}

export function getDb(): Firestore | null {
  return db;
}

export async function saveQuotesToFirestore(quotes: Quote[]): Promise<void> {
  if (!db) return;
  try {
    const col = collection(db, 'quotes');
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
  if (!db) return [];
  try {
    const col = collection(db, 'quotes');
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
  if (!db) return;
  try {
    const col = collection(db, 'grass');
    await addDoc(col, day);
  } catch {
    // silent
  }
}
