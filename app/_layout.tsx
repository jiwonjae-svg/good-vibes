import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Platform, useColorScheme, AppState, AppStateStatus } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import '../i18n';
import { initFirebase } from '../services/firebaseConfig';
import { initSentry } from '../services/sentryService';
import { configureGoogleSignIn, onAuthChange } from '../services/authService';
import { initNotificationHandler, validateAndRescheduleDailyReminder } from '../services/notificationService';
import { useGrassStore } from '../stores/useGrassStore';
import { useUserStore } from '../stores/useUserStore';
import OnboardingScreen from '../components/OnboardingScreen';
import AnimatedSplash from '../components/AnimatedSplash';
import ErrorBoundary from '../components/ErrorBoundary';

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

  // Re-validate notification schedule when the app returns to the foreground
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        const { dailyReminderEnabled, uid, displayName, currentStreak } = useUserStore.getState();
        validateAndRescheduleDailyReminder(dailyReminderEnabled, {
          uid: uid ?? undefined,
          userName: displayName ?? undefined,
          currentStreak,
        }).catch(() => {});
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
  // from AsyncStorage. Skips the first emission to avoid false sign-outs caused
  // by Firebase taking a moment to restore its session (race condition).
  useEffect(() => {
    if (!isLoaded) return;
    let firstEmission = true;
    const unsub = onAuthChange((user) => {
      if (firstEmission) {
        firstEmission = false;
        return; // Ignore – may be null while Firebase restores session
      }
      if (!user && useUserStore.getState().uid) {
        setAuth(null);
      }
    });
    return unsub;
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
      if (!inTabsGroup && !inAuthGroup) {
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
        </Stack>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
