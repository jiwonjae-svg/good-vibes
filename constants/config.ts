import Constants from 'expo-constants';

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
 * Reads a required EXPO_PUBLIC_ env var.
 * Throws a descriptive error at startup if the value is missing.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `[config] Missing required environment variable: "${key}"\n` +
        'Copy .env.example → .env and fill in all required values.',
    );
  }
  return value.trim();
}

/**
 * Reads an optional EXPO_PUBLIC_ env var, falling back to a default.
 */
function getEnv(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

/**
 * Reads a value from app.json's `extra` field (set at build time).
 * Falls back to the provided default if the value is absent.
 * Useful for non-sensitive build-time config managed via expo-constants.
 */
function getExtra<T>(key: string, fallback: T): T {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  if (extra && key in extra && extra[key] !== undefined) {
    return extra[key] as T;
  }
  return fallback;
}

// =============================================================================
// Startup Validation
// =============================================================================

const REQUIRED_ENV_VARS = [
  'EXPO_PUBLIC_GROK_API_KEY',
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
] as const;

function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === '',
  );

  if (missing.length > 0) {
    const list = missing.map((k) => `  • ${k}`).join('\n');
    throw new Error(
      `[config] App cannot start — missing required environment variables:\n${list}\n\n` +
        'Steps to fix:\n' +
        '  1. Copy .env.example to .env\n' +
        '  2. Fill in the missing values\n' +
        '  3. Restart the Expo dev server (npx expo start --clear)\n',
    );
  }
}

validateEnv();

// =============================================================================
// Config Values
// =============================================================================

export const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

export const GROK_MODEL = getEnv(
  'EXPO_PUBLIC_GROK_MODEL',
  getExtra('grokModel', 'grok-4-1-fast-non-reasoning'),
);

export const GROK_API_KEY = requireEnv('EXPO_PUBLIC_GROK_API_KEY');

export const FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: requireEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
  // Non-sensitive values fall back to app.json extra (set at build time via EAS)
  authDomain: getEnv(
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    getExtra('firebaseAuthDomain', ''),
  ),
  projectId: getEnv(
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    getExtra('firebaseProjectId', ''),
  ),
  storageBucket: getEnv(
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    getExtra('firebaseStorageBucket', ''),
  ),
  messagingSenderId: getEnv(
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    getExtra('firebaseMessagingSenderId', ''),
  ),
  appId: getEnv(
    'EXPO_PUBLIC_FIREBASE_APP_ID',
    getExtra('firebaseAppId', ''),
  ),
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
