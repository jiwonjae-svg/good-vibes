import React, { useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { AD_CONFIG } from '../constants/config';
import { useUserStore } from '../stores/useUserStore';

// Expo Go does not support native modules like AdMob.
// Only initialize when running as a standalone/dev-client build.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.executionEnvironment === ('storeClient' as ExecutionEnvironment);

let showAdFunction: (() => void) | null = null;
let isAdLoaded = false;
let ttsButtonCount = 0;
/** Callback invoked when the interstitial closes (or when no ad is shown). */
let onAdClosedCallback: (() => void) | null = null;

/**
 * Shows an interstitial ad after a follow-along activity is completed.
 * Calls `onClosed` once the ad finishes (or immediately if the ad won't be shown).
 * Only fires in production builds (not Expo Go, not __DEV__).
 * Premium users are exempt.
 */
export function showAdForActivity(isPremium: boolean, onClosed?: () => void): void {
  if (isPremium || isExpoGo || __DEV__ || !isAdLoaded) {
    // Ad won't be shown — invoke callback immediately so the caller can proceed.
    onClosed?.();
    return;
  }
  onAdClosedCallback = onClosed ?? null;
  showAdFunction?.();
}

/**
 * Call this every time the user presses the TTS read button.
 * Shows an interstitial ad every 5 presses.
 * Only fires in production builds (not Expo Go, not __DEV__).
 * Premium users are exempt.
 */
export function onTTSPressed(isPremium: boolean): void {
  if (isPremium || isExpoGo || __DEV__) return;
  ttsButtonCount += 1;
  if (ttsButtonCount >= 5) {
    ttsButtonCount = 0;
    showAdFunction?.();
  }
}

async function initAds() {
  if (isExpoGo) {
    return;
  }

  try {
    const {
      InterstitialAd,
      AdEventType,
      TestIds,
    } = require('react-native-google-mobile-ads');

    const adUnitId = __DEV__
      ? TestIds.INTERSTITIAL
      : Platform.OS === 'ios'
        ? AD_CONFIG.interstitialAdUnitId.ios
        : AD_CONFIG.interstitialAdUnitId.android;

    const interstitial = InterstitialAd.createForAdRequest(adUnitId);

    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      isAdLoaded = true;
    });

    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      isAdLoaded = false;
      // Fire the post-ad callback (e.g., show praise) then reload.
      const cb = onAdClosedCallback;
      onAdClosedCallback = null;
      cb?.();
      interstitial.load();
    });

    interstitial.addAdEventListener(AdEventType.ERROR, () => {
      isAdLoaded = false;
      setTimeout(() => interstitial.load(), 30000);
    });

    showAdFunction = () => {
      if (isAdLoaded) interstitial.show();
    };

    interstitial.load();
  } catch {
    // Native build but AdMob init failed
  }
}

export function useAdInterstitial() {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initAds();
    }
  }, []);

  /**
   * Show a scroll-based ad when the fresh scroll count hits the threshold.
   * Reads premium status directly from the store to avoid stale-closure bugs.
   */
  const tryShowAd = useCallback((count: number) => {
    const { isPremium: fresh } = useUserStore.getState();
    if (fresh || isExpoGo || __DEV__) return;
    if (count > 0 && count % AD_CONFIG.scrollsBeforeAd === 0) {
      showAdFunction?.();
    }
  }, []);

  return { tryShowAd };
}

export default function AdInterstitialProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useAdInterstitial();
  return <>{children}</>;
}
