import { Platform } from 'react-native';
import { AD_CONFIG } from '../constants/config';

let interstitialLoaded = false;

export function getInterstitialAdUnitId(): string {
  return Platform.OS === 'ios'
    ? AD_CONFIG.interstitialAdUnitId.ios
    : AD_CONFIG.interstitialAdUnitId.android;
}

export function shouldShowInterstitial(
  scrollCount: number,
  isPremium: boolean
): boolean {
  if (isPremium) return false;
  return scrollCount > 0 && scrollCount % AD_CONFIG.scrollsBeforeAd === 0;
}

export function setInterstitialLoaded(loaded: boolean): void {
  interstitialLoaded = loaded;
}

export function isInterstitialReady(): boolean {
  return interstitialLoaded;
}
