import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getDb, initFirebase } from './firebaseConfig';
import type { User } from 'firebase/auth';

// =============================================================================
// Types
// =============================================================================

export interface FirestoreUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastLogin: Timestamp;
  createdAt?: Timestamp;
  provider?: string;
  isPremium?: boolean;
  premiumPurchasedAt?: Timestamp;
}

export type ActivityType =
  | 'login'
  | 'logout'
  | 'quote_generated'
  | 'quote_shared'
  | 'quote_bookmarked'
  | 'speak_along_completed'
  | 'write_along_completed'
  | 'type_along_completed'
  | 'premium_purchased'
  | 'premium_cancelled';

export interface UserActivity {
  uid: string;
  type: ActivityType;
  timestamp: Timestamp;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// User Management
// =============================================================================

/**
 * Creates or updates a user document in the `users` collection.
 * Called on every successful login/signup.
 */
export async function syncUserToFirestore(
  user: User,
  provider: string = 'email',
): Promise<void> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return;

    const userRef = doc(db, 'users', user.uid);
    const existingDoc = await getDoc(userRef);

    const userData: Partial<FirestoreUser> = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLogin: serverTimestamp() as Timestamp,
      provider,
    };

    if (!existingDoc.exists()) {
      userData.createdAt = serverTimestamp() as Timestamp;
    }

    await setDoc(userRef, userData, { merge: true });
  } catch (error) {
    console.warn('[firestoreUserService] Failed to sync user:', error);
  }
}

/**
 * Retrieves a user document from Firestore.
 */
export async function getUserFromFirestore(
  uid: string,
): Promise<FirestoreUser | null> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return null;

    const userRef = doc(db, 'users', uid);
    const snapshot = await getDoc(userRef);

    if (snapshot.exists()) {
      return snapshot.data() as FirestoreUser;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Updates the premium status for a user in Firestore.
 */
export async function updatePremiumStatus(
  uid: string,
  isPremium: boolean,
): Promise<boolean> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return false;

    const userRef = doc(db, 'users', uid);
    const updateData: Partial<FirestoreUser> = {
      isPremium,
    };

    if (isPremium) {
      updateData.premiumPurchasedAt = serverTimestamp() as Timestamp;
    }

    await setDoc(userRef, updateData, { merge: true });
    return true;
  } catch (error) {
    console.warn('[firestoreUserService] Failed to update premium status:', error);
    return false;
  }
}

/**
 * Fetches the premium status for a user from Firestore.
 */
export async function fetchPremiumStatus(uid: string): Promise<boolean> {
  try {
    const user = await getUserFromFirestore(uid);
    return user?.isPremium ?? false;
  } catch {
    return false;
  }
}

// =============================================================================
// Activity Logging
// =============================================================================

/**
 * Logs a user activity to the `activities` collection.
 * Use this to track important user actions for analytics/audit.
 */
export async function logActivity(
  uid: string,
  type: ActivityType,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return;

    const activitiesRef = collection(db, 'activities');
    await addDoc(activitiesRef, {
      uid,
      type,
      timestamp: serverTimestamp(),
      metadata: metadata ?? null,
    });
  } catch (error) {
    console.warn('[firestoreUserService] Failed to log activity:', error);
  }
}

/**
 * Convenience function to log login activity
 */
export async function logLoginActivity(
  uid: string,
  provider: string,
): Promise<void> {
  await logActivity(uid, 'login', { provider });
}

/**
 * Convenience function to log quote generation
 */
export async function logQuoteGenerated(
  uid: string,
  quoteId?: string,
): Promise<void> {
  await logActivity(uid, 'quote_generated', { quoteId });
}

/**
 * Convenience function to log quote share
 */
export async function logQuoteShared(
  uid: string,
  quoteId: string,
): Promise<void> {
  await logActivity(uid, 'quote_shared', { quoteId });
}

/**
 * Convenience function to log activity completion
 */
export async function logActivityCompletion(
  uid: string,
  activityType: 'speak_along' | 'write_along' | 'type_along',
  score?: number,
): Promise<void> {
  const type: ActivityType = `${activityType}_completed`;
  await logActivity(uid, type, { score });
}

// =============================================================================
// Viewed Quotes — date-keyed `quoteHistory/{YYYY-MM-DD}`
// Structure:
//   users/{uid}/quoteHistory/{YYYY-MM-DD}  → { quoteIds: string[], lastUpdated }
// =============================================================================

const QUOTE_HISTORY = 'quoteHistory';

/**
 * Save bookmarked quotes to users/{uid}/quoteHistory/bookmarked
 */
export async function saveBookmarkedQuotes(
  uid: string,
  bookmarkedQuoteIds: string[],
): Promise<void> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return;
    const ref = doc(db, 'users', uid, QUOTE_HISTORY, 'bookmarked');
    await setDoc(ref, { quoteIds: bookmarkedQuoteIds, lastUpdated: serverTimestamp() });
  } catch (error) {
    console.warn('[firestoreUserService] Failed to save bookmarks:', error);
  }
}

/**
 * Fetch bookmarked quotes from users/{uid}/quoteHistory/bookmarked
 */
export async function fetchBookmarkedQuotes(uid: string): Promise<string[]> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return [];
    const ref = doc(db, 'users', uid, QUOTE_HISTORY, 'bookmarked');
    const snap = await getDoc(ref);
    if (snap.exists()) return (snap.data()?.quoteIds as string[]) ?? [];
    return [];
  } catch {
    return [];
  }
}

/**
 * Log quote bookmarked event
 */
export async function logQuoteBookmarked(
  uid: string,
  quoteId: string,
  isBookmarked: boolean,
): Promise<void> {
  await logActivity(uid, 'quote_bookmarked', { quoteId, isBookmarked });
}

/**
 * Saves viewed quote IDs for a specific date to users/{uid}/quoteHistory/{YYYY-MM-DD}
 */
export async function saveViewedQuotesForDate(
  uid: string,
  date: string,
  quoteIds: string[],
): Promise<void> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return;
    const ref = doc(db, 'users', uid, QUOTE_HISTORY, date);
    await setDoc(ref, { quoteIds, lastUpdated: serverTimestamp() });
  } catch { /* silent */ }
}

/**
 * Fetches viewed quote IDs for a specific date from users/{uid}/quoteHistory/{YYYY-MM-DD}
 */
export async function fetchViewedQuotesForDate(uid: string, date: string): Promise<string[]> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return [];
    const ref = doc(db, 'users', uid, QUOTE_HISTORY, date);
    const snap = await getDoc(ref);
    if (snap.exists()) return (snap.data()?.quoteIds as string[]) ?? [];
    return [];
  } catch {
    return [];
  }
}

// =============================================================================
// Streak  (stored on the main user doc as `users/{uid}.streak`)
// =============================================================================

/**
 * Saves the current streak to Firestore.
 */
export async function saveStreakToFirestore(
  uid: string,
  currentStreak: number,
  lastActiveDate: string,
): Promise<void> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return;
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { streak: { current: currentStreak, lastActiveDate } }, { merge: true });
  } catch { /* silent */ }
}

/**
 * Fetches the saved streak from Firestore.
 * Returns null when no streak data exists yet.
 */
export async function fetchStreakFromFirestore(
  uid: string,
): Promise<{ current: number; lastActiveDate: string } | null> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return null;
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.streak) return data.streak as { current: number; lastActiveDate: string };
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// Grass History  (`users/{uid}/grassHistory/{YYYY-MM-DD}`)
// =============================================================================

export interface GrassDay {
  date: string;
  speakCount: number;
  writeCount: number;
  typeCount: number;
  speakQuotes: Array<{ id: string; text: string; timestamp: number }>;
  writeQuotes: Array<{ id: string; text: string; timestamp: number }>;
  typeQuotes: Array<{ id: string; text: string; timestamp: number }>;
}

const GRASS_HISTORY = 'grassHistory';

/**
 * Saves a single day's grass activity to users/{uid}/grassHistory/{YYYY-MM-DD}
 */
export async function saveGrassDay(uid: string, date: string, grassDay: GrassDay): Promise<void> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return;
    const ref = doc(db, 'users', uid, GRASS_HISTORY, date);
    await setDoc(ref, grassDay);
  } catch { /* silent */ }
}

/**
 * Fetches all grass history for a user from users/{uid}/grassHistory/
 * Returns a record keyed by date string.
 */
export async function fetchGrassData(uid: string): Promise<Record<string, GrassDay>> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return {};
    const colRef = collection(db, 'users', uid, GRASS_HISTORY);
    const snap = await getDocs(colRef);
    const result: Record<string, GrassDay> = {};
    snap.forEach((docSnap) => {
      result[docSnap.id] = docSnap.data() as GrassDay;
    });
    return result;
  } catch {
    return {};
  }
}

// =============================================================================
// User Settings (preferences synced per uid)
// =============================================================================

export interface UserSettings {
  isDarkMode: boolean;
  language: string;
  selectedCategories: string[];
  autoReadEnabled: boolean;
  dailyReminderEnabled: boolean;
}

/**
 * Saves app preference settings to users/{uid}.settings in Firestore.
 * Call fire-and-forget; failures are silenced.
 */
export async function saveUserSettings(
  uid: string,
  settings: Partial<UserSettings>,
): Promise<void> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return;
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { settings }, { merge: true });
  } catch { /* silent */ }
}

/**
 * Fetches saved preference settings for a user from Firestore.
 * Returns null when no settings have been saved yet.
 */
export async function fetchUserSettings(uid: string): Promise<Partial<UserSettings> | null> {
  try {
    const user = await getUserFromFirestore(uid);
    return (user as any)?.settings ?? null;
  } catch {
    return null;
  }
}
