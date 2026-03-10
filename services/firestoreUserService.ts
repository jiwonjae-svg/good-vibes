import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  query,
  where,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getDb, initFirebase } from './firebaseConfig';
import type { User } from 'firebase/auth';
import { appLog } from './logger';

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

// =============================================================================
// Username (unique user handle, e.g. @jiwonjae)
// Stored on users/{uid}.username AND indexed in usernames/{username} → {uid}
// =============================================================================

/** Validation: only a-z A-Z 0-9 - _ , max 20 chars, min 3 chars */
export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9\-_]{3,20}$/.test(username);
}

/** Validation: display name — allows letters, numbers, spaces, - and _ only. Max 30 chars. */
export function isValidDisplayName(name: string): boolean {
  // Rejects anything that is not a letter (any script), digit, space, hyphen or underscore
  return /^[^\x00-\x1F\x7F!@#$%^&*()+={}\[\]|\\:;"'<>,.?/~`]{1,30}$/.test(name) &&
    !/[!@#$%^&*()+={}\[\]|\\:;"'<>,.?/~`]/.test(name);
}

/**
 * Checks if a username is already taken.
 * Returns true if available, false if taken.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return false;
    const ref = doc(db, 'usernames', username.toLowerCase());
    const snap = await getDoc(ref);
    return !snap.exists();
  } catch {
    return false;
  }
}

/**
 * Saves the profile (displayName + username) for a user.
 * Writes to users/{uid} and reserves usernames/{username}.
 * If the user previously had a username, the old reservation is deleted.
 */
export async function saveUserProfile(
  uid: string,
  displayName: string,
  username: string,
  previousUsername?: string,
): Promise<{ success: boolean; error?: 'taken' | 'invalid' | 'unknown' }> {
  try {
    if (!isValidUsername(username)) return { success: false, error: 'invalid' };
    if (!isValidDisplayName(displayName)) return { success: false, error: 'invalid' };

    initFirebase();
    const db = getDb();
    if (!db) return { success: false, error: 'unknown' };

    const lowerUsername = username.toLowerCase();

    // Check availability (skip if same as current)
    if (!previousUsername || previousUsername.toLowerCase() !== lowerUsername) {
      const available = await isUsernameAvailable(lowerUsername);
      if (!available) return { success: false, error: 'taken' };
    }

    // Write both docs (non-atomic but safe — username index is written last)
    await setDoc(doc(db, 'users', uid), { displayName, username: lowerUsername }, { merge: true });

    // Release old username reservation
    if (previousUsername && previousUsername.toLowerCase() !== lowerUsername) {
      try {
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'usernames', previousUsername.toLowerCase()));
      } catch { /* silent */ }
    }

    await setDoc(doc(db, 'usernames', lowerUsername), { uid, createdAt: serverTimestamp() });

    return { success: true };
  } catch {
    return { success: false, error: 'unknown' };
  }
}

// =============================================================================
// Quote Reports  (`reports/{autoId}`)
// =============================================================================

export type ReportReason = 'incorrect' | 'inappropriate' | 'duplicate' | 'other';

/**
 * Submits a user report for a quote to the `reports` collection.
 * Security rule: only the authenticated user can create their own report.
 */
export async function reportQuote(
  uid: string,
  quoteId: string,
  quoteText: string,
  reason: ReportReason,
): Promise<{ success: boolean }> {
  appLog.log('[firestore] reportQuote', { uid, quoteId, reason });
  try {
    initFirebase();
    const db = getDb();
    if (!db) return { success: false };
    await addDoc(collection(db, 'reports'), {
      uid,
      quoteId,
      quoteText: quoteText.slice(0, 300), // cap length
      reason,
      createdAt: serverTimestamp(),
    });
    appLog.log('[firestore] reportQuote success', { uid, quoteId });
    return { success: true };
  } catch (err) {
    appLog.warn('[firestore] reportQuote failed', { uid, quoteId, err: String(err) });
    return { success: false };
  }
}

// =============================================================================
// User Badges  (stored on the main user doc as `users/{uid}.badges`)
// =============================================================================

/**
 * Saves the user's earned badge array to Firestore.
 */
export async function saveUserBadges(uid: string, badges: string[]): Promise<void> {
  appLog.log('[firestore] saveUserBadges', { uid, count: badges.length });
  try {
    initFirebase();
    const db = getDb();
    if (!db) return;
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { badges }, { merge: true });
  } catch { /* silent */ }
}

/**
 * Fetches the user's earned badges from Firestore.
 */
export async function fetchUserBadges(uid: string): Promise<string[]> {
  appLog.log('[firestore] fetchUserBadges', { uid });
  try {
    initFirebase();
    const db = getDb();
    if (!db) return [];
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) return (snap.data()?.badges as string[]) ?? [];
    return [];
  } catch {
    return [];
  }
}

/**
 * Fetches the username for a given uid.
 */
export async function fetchUsername(uid: string): Promise<string | null> {
  try {
    const user = await getUserFromFirestore(uid);
    return (user as any)?.username ?? null;
  } catch {
    return null;
  }
}

/**
 * Saves a quote rating (like/dislike) to Firestore.
 */
export async function saveQuoteRating(uid: string, quoteId: string, rating: 'like' | 'dislike'): Promise<void> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return;
    const ratingRef = doc(db, 'quoteRatings', `${uid}_${quoteId}`);
    await setDoc(ratingRef, { uid, quoteId, rating, timestamp: serverTimestamp() }, { merge: true });
    appLog.log('[firestore] saveQuoteRating', { uid, quoteId, rating });
  } catch (err) {
    appLog.warn('[firestore] saveQuoteRating failed', { err: String(err) });
  }
}

