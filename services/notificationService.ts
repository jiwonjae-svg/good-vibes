import Constants, { ExecutionEnvironment } from 'expo-constants';
import i18n from '../i18n';
import { doc, updateDoc } from 'firebase/firestore';
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

/**
 * Re-validates the notification schedule when the app returns to the foreground.
 * Timezone changes or OS-level clearing can silently drop the scheduled notification.
 */
export async function validateAndRescheduleDailyReminder(
  dailyReminderEnabled: boolean,
  reminderHour = 9,
): Promise<void> {
  if (!dailyReminderEnabled) return;
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    if (scheduled.length === 0) {
      await scheduleDailyReminder(undefined, reminderHour);
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
