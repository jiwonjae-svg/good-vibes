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
  const { isPremium, scrollCount } = useUserStore();

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initAds();
    }
  }, []);

  const tryShowAd = useCallback(() => {
    if (isPremium || isExpoGo) return;
    if (scrollCount > 0 && scrollCount % AD_CONFIG.scrollsBeforeAd === 0) {
      showAdFunction?.();
    }
  }, [isPremium, scrollCount]);

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
