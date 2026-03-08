import {
  signInWithCredential,
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
} from './firestoreUserService';

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
// Sign Out
// =============================================================================

export async function logOut(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    if (!auth) return;
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
