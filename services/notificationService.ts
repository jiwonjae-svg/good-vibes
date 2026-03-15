import Constants, { ExecutionEnvironment } from 'expo-constants';
import i18n from '../i18n';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { getDb } from './firebaseConfig';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.executionEnvironment === ('storeClient' as ExecutionEnvironment);

type NotificationsModule = typeof import('expo-notifications');

function getNotifications(): NotificationsModule | null {
  if (isExpoGo) return null;
  try {
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleDailyReminder(quoteText?: string, hour = 9): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  try {
    // Check permission BEFORE cancelling — avoid wiping the schedule
    // if the user has revoked permission since the last launch.
    const granted = await requestNotificationPermission();
    if (!granted) return false;

    await Notifications.cancelAllScheduledNotificationsAsync();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t('notification.title'),
        body: quoteText ?? i18n.t('notification.body'),
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelDailyReminder(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch { /* silent */ }
}

// ─── Smart notification scheduling ──────────────────────────────────────────

/** Categories that indicate a negative-sentiment viewing pattern */
export const NEGATIVE_CATEGORIES = new Set([
  'regret', 'sadness', 'despair', 'anxiety', 'fear', 'loneliness',
  'burnout', 'breakup', 'betrayal', 'stress', 'anger', 'failure', 'jealousy',
]);

/** Streak milestones (user gets a special notification when 1 day away) */
const STREAK_MILESTONES = [7, 30, 100, 365] as const;

export interface SmartNotifOptions {
  dailyReminderEnabled: boolean;
  uid?: string;
  /** User's display name for personalised titles */
  userName?: string;
  /** User's current streak (used to detect near-milestone) */
  currentStreak?: number;
  /** Which hour(s) to schedule (8=morning, 12=noon, 21=evening). Defaults to [8, 21]. */
  notificationHours?: number[];
}

/**
 * Replaces the legacy single daily reminder with two time-slot notifications:
 *   • 08:00 — energetic morning persona (challenge / success themes)
 *   • 22:00 — soothing evening persona (comfort / love / healing themes)
 *
 * If the user is one day away from a streak milestone, an additional
 * motivational notification is scheduled for 08:30.
 *
 * All notifications fire on the local device clock, fulfilling the requirement
 * that each user sees them at *their* local time.
 */
export async function scheduleSmartNotifications(options: SmartNotifOptions): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  if (!options.dailyReminderEnabled) {
    await cancelDailyReminder();
    return false;
  }

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const { SchedulableTriggerInputTypes } = Notifications;
    const name = options.userName;
    const hours = options.notificationHours?.length ? options.notificationHours : [8, 21];

    for (const hour of hours) {
      const isMorning = hour < 12;
      const isEvening = hour >= 17;
      const titleKey = isMorning
        ? (name ? 'notification.morningTitlePersonal' : 'notification.morningTitle')
        : (isEvening ? (name ? 'notification.eveningTitlePersonal' : 'notification.eveningTitle') : 'notification.morningTitle');
      const bodyKey = isMorning ? 'notification.morningBody' : (isEvening ? 'notification.eveningBody' : 'notification.morningBody');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: name ? i18n.t(titleKey, { name }) : i18n.t(titleKey),
          body: i18n.t(bodyKey),
          sound: true,
        },
        trigger: { type: SchedulableTriggerInputTypes.DAILY, hour, minute: 0 },
      });
    }

    // ── Near-milestone — motivational boost (always at 08:30)
    const streak = options.currentStreak ?? 0;
    const nearMilestone = STREAK_MILESTONES.find((m) => m - streak === 1);
    if (nearMilestone) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t('notification.milestoneNearTitle'),
          body: i18n.t('notification.milestoneNearBody', { milestone: nearMilestone }),
          sound: true,
        },
        trigger: { type: SchedulableTriggerInputTypes.DAILY, hour: 8, minute: 30 },
      });
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Timezone changes or OS-level clearing can silently drop the scheduled notification.
 */
export async function validateAndRescheduleDailyReminder(
  dailyReminderEnabled: boolean,
  options?: Omit<SmartNotifOptions, 'dailyReminderEnabled'>,
): Promise<void> {
  if (!dailyReminderEnabled) return;
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    if (scheduled.length === 0) {
      await scheduleSmartNotifications({ dailyReminderEnabled: true, ...options });
    }
  } catch { /* silent — non-critical background check */ }
}

export function initNotificationHandler(): void {
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch { /* silent */ }
}

/**
 * Retrieves the native device push token (FCM on Android, APNs on iOS) and
 * persists it to `users/{uid}.fcmToken` in Firestore so Cloud Functions can
 * send targeted push notifications when a community quote is approved/rejected.
 *
 * Should be called once after notification permission is granted, e.g. on
 * successful login or when the user enables daily reminders.
 */
export async function saveFCMToken(uid: string): Promise<void> {
  if (!uid) return;
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (!token) return;
    const db = getDb();
    if (!db) return;
    await updateDoc(doc(db, 'users', uid), { fcmToken: token });
  } catch {
    // Non-critical — silently ignore if token retrieval or Firestore write fails
  }
}

/**
 * Checks `users/{myUid}/notifications` for unread follow notifications and
 * fires a local push notification for each one, then marks them as read.
 *
 * Called when the app returns to the foreground (see _layout.tsx AppState handler).
 * For true background delivery, a Cloud Function is required (see docs/FOLLOW-FEED-ALGORITHM.md).
 */
export async function checkFollowNotifications(myUid: string): Promise<void> {
  const db = getDb();
  if (!db || !myUid) return;

  try {
    const q = query(
      collection(db, 'users', myUid, 'notifications'),
      where('read', '==', false),
      where('type', '==', 'follow'),
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const Notifications = getNotifications();
    const batch = writeBatch(db);

    for (const notifDoc of snap.docs) {
      const data = notifDoc.data();
      // Mark as read (batch write for efficiency)
      batch.update(notifDoc.ref, { read: true });

      // Schedule an immediate local notification
      if (Notifications) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: i18n.t('notification.newFollower'),
              body: i18n.t('notification.newFollowerBody', { name: data.fromName ?? '누군가' }),
              sound: true,
            },
            trigger: null, // fire immediately
          });
        } catch { /* non-critical */ }
      }
    }

    await batch.commit();
  } catch { /* non-critical — notification check should never crash the app */ }
}
