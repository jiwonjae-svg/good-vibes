import {
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail as firebaseSendPasswordReset,
  sendEmailVerification as firebaseSendEmailVerification,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { getFirebaseAuth } from './firebaseConfig';
import {
  syncUserToFirestore,
  logLoginActivity,
  logSignupActivity,
  logActivity,
} from './firestoreUserService';
import { appLog } from './logger';

WebBrowser.maybeCompleteAuthSession();

// =============================================================================
// Google OAuth Client IDs from Environment
// =============================================================================

function getGoogleClientIds() {
  return {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
  };
}

export function useGoogleAuth() {
  const clientIds = getGoogleClientIds();

  if (!clientIds.webClientId) {
    console.warn(
      '[authService] Google OAuth not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env',
    );
  }

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: clientIds.webClientId,
    iosClientId: clientIds.iosClientId,
    androidClientId: clientIds.androidClientId,
  });

  return { request, response, promptAsync };
}

// =============================================================================
// Google Sign In
// =============================================================================

export async function signInWithGoogle(idToken: string): Promise<User | null> {
  try {
    const auth = getFirebaseAuth();
    if (!auth) return null;

    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    const user = result.user;

    await syncUserToFirestore(user, 'google');
    await logLoginActivity(user.uid, 'google');

    return user;
  } catch (error) {
    console.error('[authService] Google sign in failed:', error);
    return null;
  }
}

// =============================================================================
// Email/Password Auth
// =============================================================================

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<User | null> {
  try {
    const auth = getFirebaseAuth();
    if (!auth) return null;

    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;

    await syncUserToFirestore(user, 'email');
    await logLoginActivity(user.uid, 'email');

    return user;
  } catch (e: any) {
    throw new Error(mapFirebaseError(e?.code));
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<User | null> {
  try {
    const auth = getFirebaseAuth();
    if (!auth) return null;

    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;

    if (displayName.trim()) {
      await updateProfile(user, { displayName });
    }

    await syncUserToFirestore(user, 'email');
    await logSignupActivity(user.uid, 'email');

    appLog.log('[authService.signUpWithEmail] Sending verification email to new user');
    await sendEmailVerification(user);

    return user;
  } catch (e: any) {
    throw new Error(mapFirebaseError(e?.code));
  }
}

// =============================================================================
// Email Verification
// =============================================================================

export async function sendEmailVerification(user?: User): Promise<void> {
  const LOG = '[authService.sendEmailVerification]';
  appLog.log(`${LOG} Called, user=${user?.uid ?? 'current'}`);

  try {
    const auth = getFirebaseAuth();
    if (!auth) {
      appLog.warn(`${LOG} Firebase Auth not available (initFirebase returned null)`);
      return;
    }
    appLog.log(`${LOG} Firebase Auth OK`);

    const targetUser = user ?? auth.currentUser;
    if (!targetUser) {
      appLog.warn(`${LOG} No target user (user not passed, currentUser is null)`);
      return;
    }
    appLog.log(`${LOG} Target user: uid=${targetUser.uid}, email=${targetUser.email ?? '(none)'}`);

    if (targetUser.emailVerified) {
      appLog.log(`${LOG} User already verified, skipping`);
      return;
    }

    appLog.log(`${LOG} Calling firebaseSendEmailVerification...`);
    await firebaseSendEmailVerification(targetUser);
    appLog.log(`${LOG} firebaseSendEmailVerification succeeded`);
    await logActivity(targetUser.uid, 'email_verification_sent');
    appLog.log(`${LOG} Done`);
  } catch (e: any) {
    appLog.error(`${LOG} Failed`, e?.code ?? e?.message ?? e);
    appLog.error(`${LOG} Full error`, e);
    throw new Error(mapFirebaseError(e?.code));
  }
}

export function isEmailVerified(): boolean {
  try {
    const auth = getFirebaseAuth();
    return auth?.currentUser?.emailVerified ?? false;
  } catch {
    return false;
  }
}

export async function reloadUser(): Promise<User | null> {
  try {
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) return null;

    await auth.currentUser.reload();
    return auth.currentUser;
  } catch {
    return null;
  }
}

// =============================================================================
// Password Reset
// =============================================================================

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const LOG = '[authService.sendPasswordResetEmail]';
  appLog.log(`${LOG} Called, email=${email}`);

  try {
    const auth = getFirebaseAuth();
    if (!auth) {
      appLog.warn(`${LOG} Firebase Auth not available (initFirebase returned null)`);
      return;
    }
    appLog.log(`${LOG} Firebase Auth OK`);

    appLog.log(`${LOG} Calling firebaseSendPasswordReset...`);
    await firebaseSendPasswordReset(auth, email);
    appLog.log(`${LOG} firebaseSendPasswordReset succeeded`);
    await logActivity('anonymous', 'password_reset_requested', { email });
    appLog.log(`${LOG} Done`);
  } catch (e: any) {
    appLog.error(`${LOG} Failed`, e?.code ?? e?.message ?? e);
    appLog.error(`${LOG} Full error`, e);
    throw new Error(mapFirebaseError(e?.code));
  }
}

// =============================================================================
// Sign Out
// =============================================================================

export async function logOut(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    if (!auth) return;

    const uid = auth.currentUser?.uid;
    if (uid) {
      await logActivity(uid, 'logout');
    }

    await signOut(auth);
  } catch {
    /* silent */
  }
}

// =============================================================================
// Auth State Listener
// =============================================================================

export function onAuthChange(
  callback: (user: User | null) => void,
): () => void {
  try {
    const auth = getFirebaseAuth();
    if (!auth) return () => {};
    return onAuthStateChanged(auth, callback);
  } catch {
    return () => {};
  }
}

export function getCurrentUser(): User | null {
  try {
    const auth = getFirebaseAuth();
    return auth?.currentUser ?? null;
  } catch {
    return null;
  }
}

// =============================================================================
// Error Mapping
// =============================================================================

function mapFirebaseError(code?: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'This email is already registered.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/requires-recent-login':
      return 'Please sign in again to continue.';
    default:
      return 'An error occurred. Please try again.';
  }
}
