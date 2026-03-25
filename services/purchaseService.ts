/**
 * purchaseService.ts — RevenueCat subscription integration
 *
 * - Uses react-native-purchases (RevenueCat SDK v9)
 * - One public API key per platform (Android / iOS). The SAME key works for both
 *   sandbox (test) and production purchases. RevenueCat detects the environment
 *   automatically from the receipt.
 * - User identity is synced via Purchases.logIn(uid) after login and
 *   Purchases.logOut() after logout so that entitlements are portable across devices.
 */

import Purchases, {
  LOG_LEVEL,
  type PurchasesPackage,
  type CustomerInfo,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { appLog } from './logger';

// ---------------------------------------------------------------------------
// Config helpers (mirrors pattern in constants/config.ts)
// ---------------------------------------------------------------------------

function getExtra(key: string): string {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  if (extra && key in extra && typeof extra[key] === 'string') return extra[key] as string;
  return '';
}

function getKey(envKey: string, extraKey: string): string {
  const env = process.env[envKey];
  if (env && env.trim() !== '') return env.trim();
  return getExtra(extraKey);
}

/** RevenueCat public SDK key — Android */
const RC_KEY_ANDROID = getKey('EXPO_PUBLIC_RC_API_KEY_ANDROID', 'rcApiKeyAndroid');
/** RevenueCat public SDK key — iOS */
const RC_KEY_IOS = getKey('EXPO_PUBLIC_RC_API_KEY_IOS', 'rcApiKeyIos');

/**
 * RevenueCat entitlement identifier — must match the entitlement you created
 * in the RevenueCat dashboard (Project → Entitlements).
 */
export const RC_ENTITLEMENT_ID = 'glow_plus';

// ---------------------------------------------------------------------------
// SDK lifecycle
// ---------------------------------------------------------------------------

let _initialized = false;

/**
 * Initialize the RevenueCat SDK.
 * Call once on app startup (before any purchase or entitlement check).
 * Optionally pass the authenticated user's UID to identify them immediately.
 */
export async function initializePurchases(userId?: string): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? RC_KEY_IOS : RC_KEY_ANDROID;
  if (!apiKey) {
    appLog.warn('[purchases] RevenueCat API key not set — purchases disabled');
    return;
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  } else {
    Purchases.setLogLevel(LOG_LEVEL.ERROR);
  }

  try {
    Purchases.configure({
      apiKey,
      appUserID: userId ?? null,
    });
    _initialized = true;
    appLog.log('[purchases] SDK initialized', { userId: userId ?? 'anonymous' });
  } catch (err) {
    appLog.warn('[purchases] SDK configure failed', { err: String(err) });
  }
}

// ---------------------------------------------------------------------------
// User identity
// ---------------------------------------------------------------------------

/**
 * Associate the RevenueCat anonymous user with the authenticated app user.
 * This merges purchase history and makes entitlements available across devices.
 * Call after a successful login.
 */
export async function logInToPurchases(userId: string): Promise<void> {
  if (!_initialized) return;
  try {
    await Purchases.logIn(userId);
    appLog.log('[purchases] user identified', { userId });
  } catch (err) {
    appLog.warn('[purchases] logIn failed', { err: String(err) });
  }
}

/**
 * Return to an anonymous RevenueCat user.
 * Call after the user logs out of the app.
 */
export async function logOutFromPurchases(): Promise<void> {
  if (!_initialized) return;
  try {
    await Purchases.logOut();
    appLog.log('[purchases] user logged out');
  } catch (err) {
    // logOut can throw if user is already anonymous — safe to ignore
    appLog.warn('[purchases] logOut failed (may already be anonymous)', { err: String(err) });
  }
}

// ---------------------------------------------------------------------------
// Offerings & entitlements
// ---------------------------------------------------------------------------

/**
 * Fetch the monthly package from the current RevenueCat offering.
 * Returns null when offline or not yet configured.
 */
export async function getMonthlyPackage(): Promise<PurchasesPackage | null> {
  if (!_initialized) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return (
      offerings.current?.monthly ??
      offerings.current?.availablePackages[0] ??
      null
    );
  } catch (err) {
    appLog.warn('[purchases] getOfferings failed', { err: String(err) });
    return null;
  }
}

/**
 * Returns true when the current user has an active "glow_plus" entitlement.
 */
export function hasActiveEntitlement(info: CustomerInfo): boolean {
  return !!info.entitlements.active[RC_ENTITLEMENT_ID];
}

/**
 * Fetches the latest CustomerInfo from RevenueCat and returns whether
 * the user has an active entitlement. Safe to call on every app launch.
 */
export async function checkEntitlement(): Promise<boolean> {
  if (!_initialized) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return hasActiveEntitlement(info);
  } catch (err) {
    appLog.warn('[purchases] checkEntitlement failed', { err: String(err) });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Purchase flow
// ---------------------------------------------------------------------------

export type PurchaseResult =
  | { success: true; customerInfo: CustomerInfo }
  | { success: false; cancelled: boolean; error?: string };

/**
 * Initiate a purchase for the given package.
 * Returns a typed result — the caller is responsible for updating app state.
 */
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<PurchaseResult> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    appLog.log('[purchases] purchase success');
    return { success: true, customerInfo };
  } catch (err: unknown) {
    const e = err as { userCancelled?: boolean; message?: string; code?: number };
    if (e?.userCancelled) {
      appLog.log('[purchases] purchase cancelled by user');
      return { success: false, cancelled: true };
    }
    appLog.warn('[purchases] purchase failed', { err: String(err) });
    return { success: false, cancelled: false, error: e?.message ?? String(err) };
  }
}

/**
 * Restore purchases — use for "Restore" button.
 * Returns whether the user now has an active entitlement.
 */
export async function restoreAndCheckEntitlement(): Promise<boolean> {
  if (!_initialized) return false;
  try {
    const info = await Purchases.restorePurchases();
    appLog.log('[purchases] restore complete');
    return hasActiveEntitlement(info);
  } catch (err) {
    appLog.warn('[purchases] restore failed', { err: String(err) });
    return false;
  }
}
