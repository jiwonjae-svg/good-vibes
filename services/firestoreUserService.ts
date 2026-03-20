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
  orderBy,
  startAfter,
  serverTimestamp,
  Timestamp,
  type QueryDocumentSnapshot,
  type DocumentData,
  type QueryConstraint,
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
  communitySubmissions?: number[];
  fcmToken?: string;
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
    const isNew = !existingDoc.exists();

    const userData: Partial<FirestoreUser> = {
      uid: user.uid,
      email: user.email,
      lastLogin: serverTimestamp() as Timestamp,
      provider,
    };

    if (isNew) {
      // New user: seed profile fields from OAuth — never overwrite on subsequent logins
      userData.createdAt = serverTimestamp() as Timestamp;
      userData.displayName = user.displayName;
      userData.photoURL = user.photoURL;
      userData.followerCount = 0;
      userData.followingCount = 0;
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
 * Saves the current streak (and optional freeze state) to Firestore.
 */
export async function saveStreakToFirestore(
  uid: string,
  currentStreak: number,
  lastActiveDate: string,
  freezeCount?: number,
  freezeWeekKey?: string | null,
): Promise<void> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return;
    const userRef = doc(db, 'users', uid);
    const streakData: Record<string, unknown> = { current: currentStreak, lastActiveDate };
    if (freezeCount !== undefined) streakData.freezeCount = freezeCount;
    if (freezeWeekKey !== undefined) streakData.freezeWeekKey = freezeWeekKey ?? null;
    await setDoc(userRef, { streak: streakData }, { merge: true });
  } catch { /* silent */ }
}

/**
 * Fetches the saved streak from Firestore (including freeze state).
 * Returns null when no streak data exists yet.
 */
export async function fetchStreakFromFirestore(
  uid: string,
): Promise<{ current: number; lastActiveDate: string; freezeCount?: number; freezeWeekKey?: string | null } | null> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return null;
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.streak) return data.streak as { current: number; lastActiveDate: string; freezeCount?: number; freezeWeekKey?: string | null };
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
  ttsSpeed: number;
  /** Selected TTS voice identifier (null = system default) */
  ttsVoice?: string | null;
  notificationHours: number[];
  quoteFontSizeMultiplier: number;
  showCommunityQuotes: boolean;
  /** Ring buffer of the last 30 quote categories the user has viewed (for smart notifications) */
  recentViewedCategories?: string[];
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

/** Validation: display name — allows Unicode letters (any language), digits,
 *  spaces, hyphens, and underscores only. Rejects all other special characters
 *  and known XSS patterns. Max 30 chars. */
export function isValidDisplayName(name: string): boolean {
  if (!name || name.length === 0 || name.length > 30) return false;
  // Reject control characters
  if (/[\x00-\x1F\x7F]/.test(name)) return false;
  // Reject known XSS patterns
  if (/<script[\s>/]/i.test(name)) return false;
  if (/javascript\s*:/i.test(name)) return false;
  if (/on\w+\s*=/i.test(name)) return false;
  if (/<[a-z/]/i.test(name)) return false;
  // Allow only Unicode letters (\p{L}), digits (\p{N}), spaces, hyphens, underscores
  if (!/^[\p{L}\p{N}\s\-_]+$/u.test(name)) return false;
  return true;
}

const BIO_MAX_LENGTH = 200;

/**
 * Sanitize bio text: strip HTML/script tags, control characters, and trim to max length.
 */
export function sanitizeBio(bio: string): string {
  let s = bio
    .replace(/<[^>]*>/g, '')          // strip HTML tags
    .replace(/[\x00-\x1F\x7F]/g, '') // strip control characters
    .trim();
  if (s.length > BIO_MAX_LENGTH) s = s.slice(0, BIO_MAX_LENGTH);
  return s;
}

/**
 * Checks if a username is already taken by querying the users collection.
 * Returns true if available, false if taken.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return true; // assume available when offline/uninitialized
    const q = query(collection(db, 'users'), where('username', '==', username.toLowerCase()), limit(1));
    const snap = await getDocs(q);
    return snap.empty;
  } catch {
    return true; // assume available on error so new users aren't blocked
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
  photoURL?: string,
  bio?: string,
): Promise<{ success: boolean; error?: 'taken' | 'invalid' | 'unknown' }> {
  try {
    if (!isValidUsername(username)) return { success: false, error: 'invalid' };
    if (!isValidDisplayName(displayName)) return { success: false, error: 'invalid' };

    initFirebase();
    const db = getDb();
    if (!db) return { success: false, error: 'unknown' };

    const lowerUsername = username.toLowerCase();
    const userRef = doc(db, 'users', uid);

    // Write displayName, username, and optional photoURL directly to users/{uid}.
    // The separate 'usernames' collection has been removed as it was unused.
    const { setDoc: setDocFn } = await import('firebase/firestore');
    await setDocFn(
      userRef,
      {
        displayName,
        username: lowerUsername,
        ...(photoURL !== undefined && { photoURL }),
        ...(bio !== undefined && { bio: sanitizeBio(bio) }),
      },
      { merge: true },
    );

    return { success: true };
  } catch (err: any) {
    if (err?.code === 'taken') return { success: false, error: 'taken' };
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
export async function saveUserBadges(
  uid: string,
  badges: string[],
  badgeDates?: Record<string, string>,
): Promise<void> {
  appLog.log('[firestore] saveUserBadges', { uid, count: badges.length });
  try {
    initFirebase();
    const db = getDb();
    if (!db) return;
    const userRef = doc(db, 'users', uid);
    const payload: Record<string, unknown> = { badges };
    if (badgeDates !== undefined) payload.badgeDates = badgeDates;
    await setDoc(userRef, payload, { merge: true });
  } catch { /* silent */ }
}

/**
 * Fetches the user's earned badges from Firestore.
 */
export async function fetchUserBadges(
  uid: string,
): Promise<{ badges: string[]; badgeDates: Record<string, string> }> {
  appLog.log('[firestore] fetchUserBadges', { uid });
  try {
    initFirebase();
    const db = getDb();
    if (!db) return { badges: [], badgeDates: {} };
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        badges: (data?.badges as string[]) ?? [],
        badgeDates: (data?.badgeDates as Record<string, string>) ?? {},
      };
    }
    return { badges: [], badgeDates: {} };
  } catch {
    return { badges: [], badgeDates: {} };
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

// =============================================================================
// Social — Follow / Unfollow
// Stored in `follows/{followerId}_{followedId}` collection.
// followerCount / followingCount are stored denormalized on each user doc.
// NOTE: Firestore security rules must allow:
//   - `follows` read: authenticated users
//   - `follows` write/delete: request.auth.uid == resource.data.followerId
//   - `users/{uid}` update of followerCount/followingCount only
// =============================================================================

export interface PublicUserProfile {
  uid: string;
  displayName: string | null;
  username: string | null;
  photoURL: string | null;
  bio: string | null;
  followerCount: number;
  followingCount: number;
}

export async function fetchPublicUserProfile(targetUid: string): Promise<PublicUserProfile | null> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return null;
    const snap = await getDoc(doc(db, 'users', targetUid));
    if (!snap.exists()) return null;
    const d = snap.data() as any;
    return {
      uid: targetUid,
      displayName: d.displayName ?? null,
      username: d.username ?? null,
      photoURL: d.photoURL ?? null,
      bio: d.bio ?? null,
      followerCount: d.followerCount ?? 0,
      followingCount: d.followingCount ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Search users by username prefix (case-insensitive, lowercase comparison).
 * Returns up to `maxResults` matching public profiles.
 */
export async function searchUsersByUsername(
  usernameQuery: string,
  maxResults = 20,
): Promise<PublicUserProfile[]> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return [];
    const lq = usernameQuery.toLowerCase();
    const end = lq.slice(0, -1) + String.fromCharCode(lq.charCodeAt(lq.length - 1) + 1);
    const q = query(
      collection(db, 'users'),
      where('username', '>=', lq),
      where('username', '<', end),
      limit(maxResults),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        uid: d.id,
        displayName: data.displayName ?? null,
        username: data.username ?? null,
        photoURL: data.photoURL ?? null,
        bio: data.bio ?? null,
        followerCount: data.followerCount ?? 0,
        followingCount: data.followingCount ?? 0,
      };
    });
  } catch {
    return [];
  }
}

export async function checkIsFollowing(myUid: string, targetUid: string): Promise<boolean> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return false;
    const snap = await getDoc(doc(db, 'follows', `${myUid}_${targetUid}`));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function followUser(
  myUid: string,
  targetUid: string,
  fromName?: string | null,
  fromPhotoURL?: string | null,
): Promise<void> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return;
    const { updateDoc, increment: inc } = await import('firebase/firestore');
    await setDoc(doc(db, 'follows', `${myUid}_${targetUid}`), {
      followerId: myUid,
      followedId: targetUid,
      createdAt: serverTimestamp(),
    });
    // Denormalize counts (best-effort; silently ignored if rules restrict)
    try {
      await updateDoc(doc(db, 'users', myUid), { followingCount: inc(1) });
      await updateDoc(doc(db, 'users', targetUid), { followerCount: inc(1) });
    } catch { /* non-critical */ }
    // Write follow notification to the target user's subcollection
    try {
      await setDoc(doc(db, 'users', targetUid, 'notifications', `follow_${myUid}`), {
        type: 'follow',
        fromUid: myUid,
        fromName: fromName ?? null,
        fromPhotoURL: fromPhotoURL ?? null,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch { /* non-critical — notification delivery is best-effort */ }
    appLog.log('[firestore] followUser', { myUid, targetUid });
  } catch (err) {
    appLog.warn('[firestore] followUser failed', { err: String(err) });
    throw err;
  }
}

export async function unfollowUser(myUid: string, targetUid: string): Promise<void> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return;
    const { deleteDoc, updateDoc, increment: inc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'follows', `${myUid}_${targetUid}`));
    try {
      await updateDoc(doc(db, 'users', myUid), { followingCount: inc(-1) });
      await updateDoc(doc(db, 'users', targetUid), { followerCount: inc(-1) });
    } catch { /* non-critical */ }
    // Remove the follow notification (sender revoked the follow)
    try {
      await deleteDoc(doc(db, 'users', targetUid, 'notifications', `follow_${myUid}`));
    } catch { /* non-critical */ }
    appLog.log('[firestore] unfollowUser', { myUid, targetUid });
  } catch (err) {
    appLog.warn('[firestore] unfollowUser failed', { err: String(err) });
    throw err;
  }
}

// =============================================================================
// Follow Lists
// =============================================================================

export interface FollowUser {
  uid: string;
  displayName: string | null;
  username: string | null;
  photoURL: string | null;
}

async function _batchFetchPublicProfiles(
  db: ReturnType<typeof getDb>,
  uids: string[],
): Promise<FollowUser[]> {
  if (uids.length === 0 || !db) return [];
  const snaps = await Promise.all(uids.map((uid) => getDoc(doc(db, 'users', uid))));
  return snaps
    .filter((s) => s.exists())
    .map((s) => {
      const d = s.data() as Record<string, unknown>;
      return {
        uid: s.id,
        displayName: (d.displayName as string) ?? null,
        username: (d.username as string) ?? null,
        photoURL: (d.photoURL as string) ?? null,
      };
    });
}

/** Returns UIDs of everyone myUid follows — used to prioritize the community feed. */
export async function fetchFollowedUserIds(myUid: string, maxLimit = 200): Promise<string[]> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return [];
    const q = query(
      collection(db, 'follows'),
      where('followerId', '==', myUid),
      limit(maxLimit),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data().followedId as string);
  } catch {
    return [];
  }
}

/** Returns public profiles of users who follow targetUid (for the Followers list modal). */
export async function fetchFollowerList(targetUid: string, maxLimit = 50): Promise<FollowUser[]> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return [];
    const q = query(
      collection(db, 'follows'),
      where('followedId', '==', targetUid),
      limit(maxLimit),
    );
    const snap = await getDocs(q);
    const uids = snap.docs.map((d) => d.data().followerId as string);
    return _batchFetchPublicProfiles(db, uids);
  } catch {
    return [];
  }
}

/** Returns public profiles of users that myUid follows (for the Following list modal). */
export async function fetchFollowingList(myUid: string, maxLimit = 50): Promise<FollowUser[]> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return [];
    const q = query(
      collection(db, 'follows'),
      where('followerId', '==', myUid),
      limit(maxLimit),
    );
    const snap = await getDocs(q);
    const uids = snap.docs.map((d) => d.data().followedId as string);
    return _batchFetchPublicProfiles(db, uids);
  } catch {
    return [];
  }
}

// =============================================================================
// Admin Functions
// =============================================================================

/**
 * Checks if the given user is an admin by reading `isAdmin` from their Firestore doc.
 * Never cached locally — always fetches fresh from Firestore.
 */
export async function checkIsAdmin(uid: string): Promise<boolean> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return false;
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return false;
    return snap.data()?.isAdmin === true;
  } catch {
    return false;
  }
}

export interface AdminUser {
  uid: string;
  displayName: string | null;
  username: string | null;
  email: string | null;
  photoURL: string | null;
  isDisabled: boolean;
  createdAt?: number;
}

/**
 * Fetches a paginated list of all users for admin panel.
 */
export async function adminFetchUsers(
  pageLimit = 20,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<{ users: AdminUser[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return { users: [], lastDoc: null };
    const constraints: QueryConstraint[] = [
      orderBy('lastLogin', 'desc'),
      limit(pageLimit),
    ];
    if (cursor) constraints.push(startAfter(cursor));
    const q = query(collection(db, 'users'), ...constraints);
    const snap = await getDocs(q);
    const users: AdminUser[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        displayName: data.displayName ?? null,
        username: data.username ?? null,
        email: data.email ?? null,
        photoURL: data.photoURL ?? null,
        isDisabled: data.isDisabled === true,
        createdAt: data.createdAt?.toMillis?.() ?? undefined,
      };
    });
    return { users, lastDoc: snap.docs[snap.docs.length - 1] ?? null };
  } catch (e) {
    appLog.error('[admin] fetchUsers failed', e);
    return { users: [], lastDoc: null };
  }
}

/**
 * Toggles the disabled status of a user (admin action).
 */
export async function adminSetUserDisabled(uid: string, disabled: boolean): Promise<void> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return;
    await setDoc(doc(db, 'users', uid), { isDisabled: disabled }, { merge: true });
    appLog.log('[admin] setUserDisabled', { uid, disabled });
  } catch (e) {
    appLog.error('[admin] setUserDisabled failed', e);
  }
}

export interface AdminCommunityQuote {
  id: string;
  text: string;
  author: string;
  submitterId: string;
  submitterName: string;
  status: string;
  likeCount: number;
  reportCount: number;
  createdAt: number;
  isDisabled: boolean;
}

/**
 * Fetches community quotes for admin panel (all statuses).
 */
export async function adminFetchCommunityQuotes(
  pageLimit = 20,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<{ quotes: AdminCommunityQuote[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return { quotes: [], lastDoc: null };
    const constraints: QueryConstraint[] = [
      orderBy('createdAt', 'desc'),
      limit(pageLimit),
    ];
    if (cursor) constraints.push(startAfter(cursor));
    const q = query(collection(db, 'community_quotes'), ...constraints);
    const snap = await getDocs(q);
    const quotes: AdminCommunityQuote[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        text: data.text ?? '',
        author: data.author ?? '',
        submitterId: data.submitterId ?? '',
        submitterName: data.submitterName ?? '',
        status: data.status ?? 'approved',
        likeCount: data.likeCount ?? 0,
        reportCount: data.reportCount ?? 0,
        createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
        isDisabled: data.isDisabled === true,
      };
    });
    return { quotes, lastDoc: snap.docs[snap.docs.length - 1] ?? null };
  } catch (e) {
    appLog.error('[admin] fetchCommunityQuotes failed', e);
    return { quotes: [], lastDoc: null };
  }
}

/**
 * Fetches community quotes by a specific user (admin panel).
 */
export async function adminFetchUserQuotes(
  submitterId: string,
  pageLimit = 20,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<{ quotes: AdminCommunityQuote[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return { quotes: [], lastDoc: null };
    const constraints: QueryConstraint[] = [
      where('submitterId', '==', submitterId),
      orderBy('createdAt', 'desc'),
      limit(pageLimit),
    ];
    if (cursor) constraints.push(startAfter(cursor));
    const q = query(collection(db, 'community_quotes'), ...constraints);
    const snap = await getDocs(q);
    const quotes: AdminCommunityQuote[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        text: data.text ?? '',
        author: data.author ?? '',
        submitterId: data.submitterId ?? '',
        submitterName: data.submitterName ?? '',
        status: data.status ?? 'approved',
        likeCount: data.likeCount ?? 0,
        reportCount: data.reportCount ?? 0,
        createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
        isDisabled: data.isDisabled === true,
      };
    });
    return { quotes, lastDoc: snap.docs[snap.docs.length - 1] ?? null };
  } catch (e) {
    appLog.error('[admin] fetchUserQuotes failed', e);
    return { quotes: [], lastDoc: null };
  }
}

/**
 * Toggles the disabled status of a community quote (admin action).
 */
export async function adminSetQuoteDisabled(quoteId: string, disabled: boolean): Promise<void> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return;
    const { updateDoc: upd } = await import('firebase/firestore');
    await upd(doc(db, 'community_quotes', quoteId), { isDisabled: disabled });
    appLog.log('[admin] setQuoteDisabled', { quoteId, disabled });
  } catch (e) {
    appLog.error('[admin] setQuoteDisabled failed', e);
  }
}

export interface AdminReport {
  id: string;
  userId: string;
  quoteId: string;
  reason: string;
  createdAt: number;
  resolved: boolean;
}

/**
 * Fetches community reports for admin panel.
 */
export async function adminFetchReports(
  pageLimit = 20,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<{ reports: AdminReport[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return { reports: [], lastDoc: null };
    const constraints: QueryConstraint[] = [
      orderBy('createdAt', 'desc'),
      limit(pageLimit),
    ];
    if (cursor) constraints.push(startAfter(cursor));
    const q = query(collection(db, 'community_reports'), ...constraints);
    const snap = await getDocs(q);
    const reports: AdminReport[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId ?? '',
        quoteId: data.quoteId ?? '',
        reason: data.reason ?? '',
        createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
        resolved: data.resolved === true,
      };
    });
    return { reports, lastDoc: snap.docs[snap.docs.length - 1] ?? null };
  } catch (e) {
    appLog.error('[admin] fetchReports failed', e);
    return { reports: [], lastDoc: null };
  }
}

/**
 * Toggles the resolved status of a report (admin action).
 */
export async function adminSetReportResolved(reportId: string, resolved: boolean): Promise<void> {
  try {
    initFirebase();
    const db = getDb();
    if (!db) return;
    const { updateDoc: upd } = await import('firebase/firestore');
    await upd(doc(db, 'community_reports', reportId), { resolved });
    appLog.log('[admin] setReportResolved', { reportId, resolved });
  } catch (e) {
    appLog.error('[admin] setReportResolved failed', e);
  }
}

