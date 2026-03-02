import Constants from 'expo-constants';
import { Platform } from 'react-native';

// =============================================================================
// TypeScript Interfaces
// =============================================================================

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface AdConfig {
  interstitialAdUnitId: {
    android: string;
    ios: string;
  };
  scrollsBeforeAd: number;
}

export interface QuoteConfig {
  batchSize: number;
  prefetchThreshold: number;
}

export interface SimilarityConfig {
  speakThreshold: number;
  writeThreshold: number;
  typeThreshold: number;
}

export interface GrokConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

export interface AppConfig {
  grok: GrokConfig;
  firebase: FirebaseConfig;
  ads: AdConfig;
  quotes: QuoteConfig;
  similarity: SimilarityConfig;
}

// =============================================================================
// Environment Variable Helpers
// =============================================================================

/**
 * Reads a value from app.json's `extra` field (set at build time).
 * Falls back to the provided default if the value is absent.
 */
function getExtra<T>(key: string, fallback: T): T {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  if (extra && key in extra && extra[key] !== undefined) {
    return extra[key] as T;
  }
  return fallback;
}

/**
 * Reads an optional EXPO_PUBLIC_ env var, falling back to a default.
 */
function getEnv(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

/**
 * Reads a required env var with fallback from extra config.
 * Returns empty string if not found (won't crash).
 */
function getEnvOrExtra(envKey: string, extraKey: string, fallback: string = ''): string {
  const envValue = process.env[envKey];
  if (envValue && envValue.trim() !== '') {
    return envValue.trim();
  }
  return getExtra(extraKey, fallback);
}

// =============================================================================
// Config Values
// =============================================================================

export const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

export const GROK_MODEL = getEnvOrExtra(
  'EXPO_PUBLIC_GROK_MODEL',
  'grokModel',
  'grok-4-1-fast-non-reasoning',
);

export const GROK_API_KEY = getEnvOrExtra(
  'EXPO_PUBLIC_GROK_API_KEY',
  'grokApiKey',
  '',
);

export const FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: getEnvOrExtra('EXPO_PUBLIC_FIREBASE_API_KEY', 'firebaseApiKey', ''),
  authDomain: getEnvOrExtra('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'firebaseAuthDomain', ''),
  projectId: getEnvOrExtra('EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'firebaseProjectId', ''),
  storageBucket: getEnvOrExtra('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', 'firebaseStorageBucket', ''),
  messagingSenderId: getEnvOrExtra('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'firebaseMessagingSenderId', ''),
  appId: Platform.OS === 'ios'
    ? getEnvOrExtra('EXPO_PUBLIC_FIREBASE_APP_ID_IOS', 'firebaseAppIdIos', '')
    : getEnvOrExtra('EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID', 'firebaseAppIdAndroid', ''),
};

export const AD_CONFIG: AdConfig = {
  interstitialAdUnitId: {
    android: getEnv(
      'EXPO_PUBLIC_AD_UNIT_ANDROID',
      // Google's official test ID — safe default during development
      'ca-app-pub-3940256099942544/1033173712',
    ),
    ios: getEnv(
      'EXPO_PUBLIC_AD_UNIT_IOS',
      'ca-app-pub-3940256099942544/4411468910',
    ),
  },
  scrollsBeforeAd: 5,
};

export const QUOTE_CONFIG: QuoteConfig = {
  batchSize: 10,
  prefetchThreshold: 3,
};

export const SIMILARITY_CONFIG: SimilarityConfig = {
  speakThreshold: 0.8,
  writeThreshold: 0.7,
  typeThreshold: 1.0,
};

// =============================================================================
// Unified Config Object
// =============================================================================

const config: AppConfig = {
  grok: {
    apiUrl: GROK_API_URL,
    apiKey: GROK_API_KEY,
    model: GROK_MODEL,
  },
  firebase: FIREBASE_CONFIG,
  ads: AD_CONFIG,
  quotes: QUOTE_CONFIG,
  similarity: SIMILARITY_CONFIG,
};

export default config;
