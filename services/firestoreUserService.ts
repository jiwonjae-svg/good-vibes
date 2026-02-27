import {
  doc,
  setDoc,
  getDoc,
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
  emailVerified?: boolean;
  provider?: string;
}

export type ActivityType =
  | 'login'
  | 'signup'
  | 'logout'
  | 'quote_generated'
  | 'quote_shared'
  | 'quote_bookmarked'
  | 'speak_along_completed'
  | 'write_along_completed'
  | 'type_along_completed'
  | 'password_reset_requested'
  | 'email_verification_sent';

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
      emailVerified: user.emailVerified,
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
 * Convenience function to log signup activity
 */
export async function logSignupActivity(
  uid: string,
  provider: string,
): Promise<void> {
  await logActivity(uid, 'signup', { provider });
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
