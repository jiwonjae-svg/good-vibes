import {
  getAuth,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail as firebaseSendPasswordReset,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { initFirebase } from './firebaseConfig';

WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_CLIENT_IDS = {
  webClientId: 'YOUR_WEB_CLIENT_ID',
  iosClientId: 'YOUR_IOS_CLIENT_ID',
  androidClientId: 'YOUR_ANDROID_CLIENT_ID',
};

export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_IDS.webClientId,
    iosClientId: GOOGLE_CLIENT_IDS.iosClientId,
    androidClientId: GOOGLE_CLIENT_IDS.androidClientId,
  });
  return { request, response, promptAsync };
}

function getFirebaseAuth() {
  try {
    initFirebase();
    return getAuth();
  } catch {
    return null;
  }
}

export async function signInWithGoogle(idToken: string): Promise<User | null> {
  try {
    const auth = getFirebaseAuth();
    if (!auth) return null;
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    return result.user;
  } catch {
    return null;
  }
}

export async function signInWithEmail(email: string, password: string): Promise<User | null> {
  try {
    const auth = getFirebaseAuth();
    if (!auth) return null;
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
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
    if (displayName.trim()) {
      await updateProfile(result.user, { displayName });
    }
    return result.user;
  } catch (e: any) {
    throw new Error(mapFirebaseError(e?.code));
  }
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await firebaseSendPasswordReset(auth, email);
  } catch (e: any) {
    throw new Error(mapFirebaseError(e?.code));
  }
}

export async function logOut(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await signOut(auth);
  } catch { /* silent */ }
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  try {
    const auth = getFirebaseAuth();
    if (!auth) return () => {};
    return onAuthStateChanged(auth, callback);
  } catch {
    return () => {};
  }
}

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
    default:
      return 'An error occurred. Please try again.';
  }
}
