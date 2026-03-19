import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Platform, useColorScheme, AppState, AppStateStatus } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import '../i18n';
import { initFirebase } from '../services/firebaseConfig';
import { initSentry } from '../services/sentryService';
import { configureGoogleSignIn, onAuthChange, getCurrentUser, logOut } from '../services/authService';
import { initNotificationHandler, validateAndRescheduleDailyReminder, checkFollowNotifications } from '../services/notificationService';
import { saveStreakForWidget } from '../services/widgetService';
import { useGrassStore } from '../stores/useGrassStore';
import { useUserStore } from '../stores/useUserStore';
import OnboardingScreen from '../components/OnboardingScreen';
import AnimatedSplash from '../components/AnimatedSplash';
import ErrorBoundary from '../components/ErrorBoundary';
import MilestoneBadgeModal from '../components/MilestoneBadgeModal';
import GoogleSignInConfirmModal from '../components/GoogleSignInConfirmModal';
import ProfileSetupModal from '../components/ProfileSetupModal';
import PraiseModal from '../components/PraiseModal';
import { appLog } from '../services/logger';

// Module-level flag: ensures the splash plays only once per JS runtime session,
// even if RootLayout somehow remounts (e.g. after settings onboarding replay).
let _splashHasPlayed = false;

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const loadGrass = useGrassStore((s) => s.loadGrassData);
  const loadUser = useUserStore((s) => s.loadUser);
  const isLoaded = useUserStore((s) => s.isLoaded);
  const isDarkMode = useUserStore((s) => s.isDarkMode);
  const setDarkMode = useUserStore((s) => s.setDarkMode);
  const followSystemDarkMode = useUserStore((s) => s.followSystemDarkMode);
  const hasCompletedAuth = useUserStore((s) => s.hasCompletedAuth);
  const hasSeenOnboarding = useUserStore((s) => s.hasSeenOnboarding);
  const setOnboardingSeen = useUserStore((s) => s.setOnboardingSeen);
  const setAuth = useUserStore((s) => s.setAuth);
  const showOnboardingFlag = useUserStore((s) => s.showOnboardingFlag);
  const setShowOnboardingFlag = useUserStore((s) => s.setShowOnboardingFlag);
  const newBadgeEarned = useUserStore((s) => s.newBadgeEarned);
  const clearNewBadge = useUserStore((s) => s.clearNewBadge);
  const pendingNewUserSignIn = useUserStore((s) => s.pendingNewUserSignIn);
  const setPendingNewUserSignIn = useUserStore((s) => s.setPendingNewUserSignIn);
  const setProfile = useUserStore((s) => s.setProfile);
  const setAuthCompleted = useUserStore((s) => s.setAuthCompleted);
  const pendingPraise = useUserStore((s) => s.pendingPraise);
  const setPendingPraise = useUserStore((s) => s.setPendingPraise);
  const awardFirstLoginBadge = useUserStore((s) => s.awardFirstLoginBadge);

  // ── Modal queue: ensures at most one modal is visible at any time ──────────
  // Modals are enqueued by type and shown in FIFO order. When the front modal
  // is dismissed, the next one becomes visible automatically.
  type ModalEntry =
    | { type: 'googleConfirm' }
    | { type: 'profileSetup' }
    | { type: 'badge'; badgeId: string }
    | { type: 'praise'; praise: string };

  const [modalQueue, setModalQueue] = useState<ModalEntry[]>([]);
  const activeModal = modalQueue[0] ?? null;

  const dismissFrontModal = useCallback(() => {
    setModalQueue((q) => q.slice(1));
  }, []);

  // Enqueue new-user onboarding modals when pendingNewUserSignIn fires
  useEffect(() => {
    if (!pendingNewUserSignIn) return;
    setModalQueue((q) => {
      // Avoid duplicates
      if (q.some((m) => m.type === 'googleConfirm')) return q;
      return [...q, { type: 'googleConfirm' }];
    });
  }, [pendingNewUserSignIn]);

  // Enqueue badge modal when a new badge is earned
  useEffect(() => {
    if (!newBadgeEarned) return;
    setModalQueue((q) => {
      if (q.some((m) => m.type === 'badge' && m.badgeId === newBadgeEarned)) return q;
      return [...q, { type: 'badge', badgeId: newBadgeEarned }];
    });
  }, [newBadgeEarned]);

  // Enqueue praise modal when pendingPraise is set (activity completion)
  useEffect(() => {
    if (!pendingPraise) return;
    setModalQueue((q) => {
      if (q.some((m) => m.type === 'praise')) return q;
      // Insert praise before any badge modals so the user sees activity feedback first
      const badges = q.filter((m) => m.type === 'badge');
      const rest = q.filter((m) => m.type !== 'badge');
      return [...rest, { type: 'praise', praise: pendingPraise }, ...badges];
    });
  }, [pendingPraise]);

  const handleNewUserConfirmAgree = useCallback(() => {
    // Replace the googleConfirm entry with profileSetup so it shows next
    setModalQueue((q) => {
      const rest = q.filter((m) => m.type !== 'googleConfirm');
      return [{ type: 'profileSetup' as const }, ...rest];
    });
  }, []);

  const handleNewUserConfirmCancel = useCallback(async () => {
    dismissFrontModal();
    setPendingNewUserSignIn(null);
    // Fully sign out so the user is not left in a half-authenticated state
    await setAuth(null);
    logOut().catch(() => {});
  }, [setPendingNewUserSignIn, dismissFrontModal, setAuth]);

  const handleNewUserProfileComplete = useCallback(async (displayName: string, username: string) => {
    appLog.log('[layout] new user profile complete', { displayName, username });
    await setProfile(displayName, username);
    await setAuthCompleted();
    setPendingNewUserSignIn(null);
    dismissFrontModal();
    // Award first_login badge AFTER consent + profile setup (shown via modal queue)
    await awardFirstLoginBadge();
  }, [setProfile, setAuthCompleted, setPendingNewUserSignIn, dismissFrontModal, awardFirstLoginBadge]);

  const handleNewUserProfileSkip = useCallback(async () => {
    const randomSuffix = Date.now().toString(36).slice(-6);
    const randomUsername = `user_${randomSuffix}`;
    const name = pendingNewUserSignIn?.displayName ?? 'User';
    try { await setProfile(name, randomUsername); } catch { /* best-effort */ }
    await setAuthCompleted();
    setPendingNewUserSignIn(null);
    dismissFrontModal();
    // Award first_login badge AFTER consent + profile setup (shown via modal queue)
    await awardFirstLoginBadge();
  }, [pendingNewUserSignIn, setProfile, setAuthCompleted, setPendingNewUserSignIn, dismissFrontModal, awardFirstLoginBadge]);

  // Re-validate notification schedule when the app returns to the foreground
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        const { dailyReminderEnabled, uid, displayName, currentStreak, refreshCloudData } = useUserStore.getState();
        validateAndRescheduleDailyReminder(dailyReminderEnabled, {
          uid: uid ?? undefined,
          userName: displayName ?? undefined,
          currentStreak,
        }).catch(() => {});
        // Re-sync badge/streak/social data when coming back to foreground.
        // This also recovers cloud data that was unavailable at login (offline scenario).
        if (uid) {
          refreshCloudData().catch(() => {});
          checkFollowNotifications(uid).catch(() => {});
          // Refresh widget streak in case it was stale
          if (currentStreak > 0) saveStreakForWidget(currentStreak).catch(() => {});
        }
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // Sync dark mode with system preference when user has opted in
  useEffect(() => {
    if (followSystemDarkMode) {
      setDarkMode(colorScheme === 'dark');
    }
  }, [colorScheme, followSystemDarkMode]);
  
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSplash, setShowSplash] = useState(!_splashHasPlayed);

  // Single global auth listener — set up only after the user store has loaded
  // from AsyncStorage. Uses a 3-second grace window on the first null emission so
  // that a transient null while Firebase restores its session does not trigger a
  // false sign-out. Once a valid user emission has been received, any subsequent
  // null is treated immediately as a genuine sign-out.
  useEffect(() => {
    if (!isLoaded) return;
    let sessionInitialized = false;
    let signOutTimer: ReturnType<typeof setTimeout> | null = null;
    const unsub = onAuthChange((user) => {
      if (signOutTimer) { clearTimeout(signOutTimer); signOutTimer = null; }
      if (user) {
        sessionInitialized = true;
        return;
      }
      if (!useUserStore.getState().uid) return;
      if (sessionInitialized) {
        // A confirmed session went null → genuine sign-out
        setAuth(null);
      } else {
        // First emission is null: Firebase may still be restoring session.
        // Wait 3 s, then verify with the SDK before acting.
        signOutTimer = setTimeout(() => {
          signOutTimer = null;
          if (!getCurrentUser() && useUserStore.getState().uid) {
            setAuth(null);
            // Also clear GoogleSignin cache so the account-picker appears on the
            // next login attempt instead of silently re-signing in.
            logOut().catch(() => {});
          }
        }, 3000);
      }
    });
    return () => {
      unsub();
      if (signOutTimer) clearTimeout(signOutTimer);
    };
  }, [isLoaded]);

  useEffect(() => {
    initSentry();
    initFirebase();
    configureGoogleSignIn();
    initNotificationHandler();
    loadGrass();
    loadUser();
    // Ensure the Android navigation bar stays visible (already set in app.config.js);
    // remove previous 'hidden' override so the safe-area insets drive tab bar height.
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('visible').catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || showSplash) return;

    const inAuthGroup = segments[0] === 'login';
    const inTabsGroup = segments[0] === '(tabs)';

    if (showOnboardingFlag) {
      setShowOnboarding(true);
      return;
    }

    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    } else if (!hasCompletedAuth) {
      setShowOnboarding(false);
      if (!inAuthGroup) {
        router.replace('/login');
      }
    } else {
      setShowOnboarding(false);
      if (!inTabsGroup) {
        router.replace('/(tabs)');
      }
    }
  }, [isLoaded, hasCompletedAuth, hasSeenOnboarding, segments, showOnboardingFlag, showSplash]);

  const handleOnboardingComplete = async () => {
    await setOnboardingSeen();
    setShowOnboarding(false);
    // Capture the flag before clearing it — true means replay was triggered from Settings.
    const wasFromSettings = useUserStore.getState().showOnboardingFlag;
    setShowOnboardingFlag(false);

    if (wasFromSettings) {
      // Return to Settings instead of navigating to home/login.
      router.replace('/(tabs)/settings');
    } else if (!hasCompletedAuth) {
      router.replace('/login');
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSplashComplete = useCallback(() => {
    _splashHasPlayed = true;
    setShowSplash(false);
  }, []);

  if (showSplash) {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={styles.root}>
          <StatusBar style="dark" />
          <AnimatedSplash onAnimationComplete={handleSplashComplete} />
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }

  if (showOnboarding) {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={styles.root}>
          <StatusBar style={isDarkMode ? 'light' : 'dark'} />
          <OnboardingScreen onComplete={handleOnboardingComplete} isReplay={showOnboardingFlag} />
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="quote" options={{ gestureEnabled: false, animation: 'none' }} />
        </Stack>
        {/* Global badge milestone modal — shown via modal queue */}
        <MilestoneBadgeModal
          badgeId={activeModal?.type === 'badge' ? activeModal.badgeId : null}
          onClose={() => { if (newBadgeEarned) appLog.log('[layout] badge modal dismissed', { badgeId: newBadgeEarned }); clearNewBadge(); dismissFrontModal(); }}
        />
        {/* New-user onboarding modals — shown via modal queue */}
        <GoogleSignInConfirmModal
          visible={activeModal?.type === 'googleConfirm'}
          email={pendingNewUserSignIn?.email ?? null}
          onConfirm={handleNewUserConfirmAgree}
          onCancel={handleNewUserConfirmCancel}
        />
        <ProfileSetupModal
          visible={activeModal?.type === 'profileSetup'}
          initialDisplayName={pendingNewUserSignIn?.displayName}
          onComplete={handleNewUserProfileComplete}
          onSkip={handleNewUserProfileSkip}
        />
        {/* Praise modal — shown via modal queue after activity completion */}
        <PraiseModal
          visible={activeModal?.type === 'praise'}
          praise={activeModal?.type === 'praise' ? activeModal.praise : ''}
          onClose={() => { setPendingPraise(null); dismissFrontModal(); }}
        />
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
