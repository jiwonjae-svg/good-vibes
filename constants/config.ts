export const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
export const GROK_MODEL = 'grok-4-1-fast-non-reasoning';

// Replace with your actual API key (use env vars in production)
export const GROK_API_KEY = 'YOUR_GROK_API_KEY';

export const FIREBASE_CONFIG = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

export const AD_CONFIG = {
  interstitialAdUnitId: {
    android: 'ca-app-pub-3940256099942544/1033173712',
    ios: 'ca-app-pub-3940256099942544/4411468910',
  },
  scrollsBeforeAd: 5,
};

export const QUOTE_CONFIG = {
  batchSize: 10,
  prefetchThreshold: 3,
};

export const SIMILARITY_CONFIG = {
  speakThreshold: 0.8,
  writeThreshold: 0.7,
  typeThreshold: 1.0,
};
