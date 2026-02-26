import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.executionEnvironment === ('storeClient' as ExecutionEnvironment);

export function initSentry(): void {
  if (__DEV__ || isExpoGo) return;

  try {
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: 'YOUR_SENTRY_DSN',
      enableAutoSessionTracking: true,
      tracesSampleRate: 0.2,
    });
  } catch {
    // Sentry not available
  }
}

export function captureException(error: unknown): void {
  if (__DEV__) {
    console.error(error);
    return;
  }
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.captureException(error);
  } catch { /* silent */ }
}
