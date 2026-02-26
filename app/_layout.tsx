import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import '../i18n';
import { initFirebase } from '../services/firebaseConfig';
import { initSentry } from '../services/sentryService';
import { initNotificationHandler } from '../services/notificationService';
import { useGrassStore } from '../stores/useGrassStore';
import { useUserStore } from '../stores/useUserStore';
import OnboardingScreen from '../components/OnboardingScreen';
import LoginScreen from './login';

export default function RootLayout() {
  const loadGrass = useGrassStore((s) => s.loadGrassData);
  const loadUser = useUserStore((s) => s.loadUser);
  const isLoaded = useUserStore((s) => s.isLoaded);
  const isDarkMode = useUserStore((s) => s.isDarkMode);
  const hasCompletedAuth = useUserStore((s) => s.hasCompletedAuth);
  const hasSeenOnboarding = useUserStore((s) => s.hasSeenOnboarding);
  const setOnboardingSeen = useUserStore((s) => s.setOnboardingSeen);

  useEffect(() => {
    initSentry();
    initFirebase();
    initNotificationHandler();
    loadGrass();
    loadUser();
  }, []);

  // Wait for persisted state to load
  if (!isLoaded) return null;

  // Step 1: Login gate (first time or not logged in/skipped)
  if (!hasCompletedAuth) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <LoginScreen />
      </GestureHandlerRootView>
    );
  }

  // Step 2: Onboarding (first launch after auth)
  if (!hasSeenOnboarding) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <OnboardingScreen onComplete={setOnboardingSeen} />
      </GestureHandlerRootView>
    );
  }

  // Step 3: Main app
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
