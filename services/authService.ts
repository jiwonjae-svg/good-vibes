import {
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { getFirebaseAuth } from './firebaseConfig';
import {
  syncUserToFirestore,
  logLoginActivity,
} from './firestoreUserService';

// =============================================================================
// Configure Google Sign-In (call once at app startup)
// =============================================================================

export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    scopes: ['email', 'profile'],
    offlineAccess: true,
  });
}

// =============================================================================
// Native Google Sign-In → shows OS account picker → Firebase credential
// =============================================================================

export async function signInWithGoogleNative(): Promise<User | null> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo.data?.idToken;
    if (!idToken) {
      console.error('[authService] No idToken from Google Sign-In');
      return null;
    }
    return await _firebaseSignIn(idToken);
  } catch (error: any) {
    if (
      error.code === statusCodes.SIGN_IN_CANCELLED ||
      error.code === statusCodes.IN_PROGRESS
    ) {
      return null; // user cancelled or already in progress — not an error
    }
    console.error('[authService] Native Google Sign-In failed:', error);
    throw error; // re-throw so callers can show error UI
  }
}

// Internal: exchange Google idToken for a Firebase user
async function _firebaseSignIn(idToken: string): Promise<User | null> {
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
    console.error('[authService] Firebase sign-in with Google credential failed:', error);
    return null;
  }
}

// =============================================================================
// Sign Out — clears both Firebase session AND cached Google account
// =============================================================================

export async function logOut(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    // Also clear the GoogleSignin cached account so the picker shows on next login
    await GoogleSignin.signOut();
  } catch {
    // silent
  }
}

// =============================================================================
// Auth state listener
// =============================================================================

export function onAuthChange(callback: (user: User | null) => void) {
  const auth = getFirebaseAuth();
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  const auth = getFirebaseAuth();
  return auth?.currentUser ?? null;
}

