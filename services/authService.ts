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
import { appLog } from './logger';

// =============================================================================
// Configure Google Sign-In (call once at app startup)
// =============================================================================

export function configureGoogleSignIn() {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
  appLog.log('[authService] configureGoogleSignIn', { webClientId: webClientId.slice(0, 30) + '...' });
  GoogleSignin.configure({
    webClientId,
    scopes: ['email', 'profile'],
    offlineAccess: true,
  });
}

// =============================================================================
// Native Google Sign-In → shows OS account picker → Firebase credential
// =============================================================================

export async function signInWithGoogleNative(): Promise<User | null> {
  try {
    appLog.log('[authService] signInWithGoogleNative: start');
    const hasPlay = await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    appLog.log('[authService] hasPlayServices', { hasPlay });
    const userInfo = await GoogleSignin.signIn();
    appLog.log('[authService] GoogleSignin.signIn success', {
      email: userInfo.data?.user?.email,
      hasIdToken: !!userInfo.data?.idToken,
    });
    const idToken = userInfo.data?.idToken;
    if (!idToken) {
      appLog.error('[authService] No idToken in GoogleSignin response', userInfo);
      return null;
    }
    return await _firebaseSignIn(idToken);
  } catch (error: any) {
    if (
      error.code === statusCodes.SIGN_IN_CANCELLED ||
      error.code === statusCodes.IN_PROGRESS
    ) {
      appLog.log('[authService] signInWithGoogleNative: user cancelled or in-progress', { code: error.code });
      return null;
    }
    appLog.error('[authService] signInWithGoogleNative failed', {
      code: error?.code,
      message: error?.message,
      domain: error?.domain,
    });
    throw error;
  }
}

// Internal: exchange Google idToken for a Firebase user
async function _firebaseSignIn(idToken: string): Promise<User | null> {
  try {
    appLog.log('[authService] _firebaseSignIn: exchanging idToken for Firebase credential');
    const auth = getFirebaseAuth();
    if (!auth) {
      appLog.error('[authService] Firebase auth not initialized');
      return null;
    }

    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    const user = result.user;
    appLog.log('[authService] Firebase signInWithCredential success', { uid: user.uid, email: user.email });

    await syncUserToFirestore(user, 'google');
    await logLoginActivity(user.uid, 'google');
    appLog.log('[authService] Firestore sync complete');

    return user;
  } catch (error: any) {
    appLog.error('[authService] _firebaseSignIn failed', {
      code: error?.code,
      message: error?.message,
    });
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

