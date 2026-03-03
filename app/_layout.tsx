import React, { useEffect, useState, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import '../i18n';
import { initFirebase } from '../services/firebaseConfig';
import { initSentry } from '../services/sentryService';
import { initNotificationHandler } from '../services/notificationService';
import { useGrassStore } from '../stores/useGrassStore';
import { useUserStore } from '../stores/useUserStore';
import OnboardingScreen from '../components/OnboardingScreen';
import AnimatedSplash from '../components/AnimatedSplash';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const loadGrass = useGrassStore((s) => s.loadGrassData);
  const loadUser = useUserStore((s) => s.loadUser);
  const isLoaded = useUserStore((s) => s.isLoaded);
  const isDarkMode = useUserStore((s) => s.isDarkMode);
  const hasCompletedAuth = useUserStore((s) => s.hasCompletedAuth);
  const hasSeenOnboarding = useUserStore((s) => s.hasSeenOnboarding);
  const setOnboardingSeen = useUserStore((s) => s.setOnboardingSeen);
  const showOnboardingFlag = useUserStore((s) => s.showOnboardingFlag);
  const setShowOnboardingFlag = useUserStore((s) => s.setShowOnboardingFlag);
  
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    initSentry();
    initFirebase();
    initNotificationHandler();
    loadGrass();
    loadUser();
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
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
    setShowOnboardingFlag(false);
    
    if (!hasCompletedAuth) {
      router.replace('/login');
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  if (showSplash) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style="dark" />
        <AnimatedSplash onAnimationComplete={handleSplashComplete} />
      </GestureHandlerRootView>
    );
  }

  if (showOnboarding) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
