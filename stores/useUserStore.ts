import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { LANGUAGES } from '../i18n';
import * as Localization from 'expo-localization';
import type { LanguageCode } from '../i18n';
import { clearQuoteCache } from '../services/quoteService';
import { appLog } from '../services/logger';
import { scheduleSmartNotifications } from '../services/notificationService';
import { updatePremiumStatus, fetchPremiumStatus, logActivity, saveBookmarkedQuotes, fetchBookmarkedQuotes, logQuoteBookmarked, saveViewedQuotesForDate, fetchViewedQuotesForDate, saveStreakToFirestore, fetchStreakFromFirestore, saveUserSettings, fetchUserSettings, fetchUsername, saveUserProfile, saveUserBadges, saveQuoteRating, fetchPublicUserProfile } from '../services/firestoreUserService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getISOWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date as unknown as number) - (yearStart as unknown as number)) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function dateDiffInDays(a: string | null, b: string): number {
  if (!a) return 999;
  if (!ISO_DATE_RE.test(a) || !ISO_DATE_RE.test(b)) return 999;
  const utcA = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const utcB = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  const diff = Math.round((utcB - utcA) / 86400000);
  return isNaN(diff) ? 999 : diff;
}

export const STREAK_BADGE_THRESHOLDS = [3, 7, 30, 100, 365] as const;
export type BadgeId = `streak_${typeof STREAK_BADGE_THRESHOLDS[number]}`;
export const QUOTE_BADGE_THRESHOLDS = [50, 200, 500] as const;
export const BOOKMARK_BADGE_THRESHOLDS = [5, 20] as const;

interface UserState {
  isPremium: boolean;
  scrollCount: number;
  totalQuotesViewed: number;
  isLoaded: boolean;
  isDarkMode: boolean;
  language: LanguageCode;
  selectedCategories: string[];
  dailyReminderEnabled: boolean;
  autoReadEnabled: boolean;
  hasSeenOnboarding: boolean;
  hasCompletedAuth: boolean;
  bookmarkedQuoteIds: string[];
  todayViewedQuoteIds: string[];
  todayViewedDate: string | null;
  /** All-time list of q_ids the user has ever scrolled past. Synced to Firestore. */
  allViewedQuoteIds: string[];
  showOnboardingFlag: boolean;

  // Auth
  uid: string | null;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  username: string | null;

  // Streak
  currentStreak: number;
  lastActiveDate: string | null;

  // Streak Freeze (1 granted per ISO week, auto-used when 1 day missed)
  streakFreezeCount: number;
  streakFreezeWeekKey: string | null;

  // Badges
  earnedBadges: string[];
  newBadgeEarned: string | null; // transient: badge id just awarded, for toast display

  // Premium trial (7 days)
  premiumTrialExpiry: string | null; // ISO date string
  premiumTrialUsed: boolean;

  // Display preferences
  quoteFontSizeMultiplier: number; // 0.85 | 1.0 | 1.15 | 1.3
  followSystemDarkMode: boolean;

  // Guest trial
  guestTrialCount: number;

  // Notification
  notificationHour: number; // 8 | 12 | 21 — legacy single-slot
  notificationHours: number[]; // multi-slot, e.g. [8, 21]

  // TTS speed
  ttsSpeed: number; // 0.6 | 0.9 | 1.2

  // Badge earned dates
  earnedBadgeDates: Record<string, string>; // badgeId → YYYY-MM-DD

  // Quote ratings
  likedQuoteIds: string[];
  dislikedQuoteIds: string[];

  // Community feed preference
  showCommunityQuotes: boolean;

  // Total community submissions (for community_5 badge)
  communitySubmitCount: number;

  // Recent category views (ring buffer) — synced to Firestore for smart notifications
  recentViewedCategories: string[];

  // Social counts (synced from Firestore on login)
  followerCount: number;
  followingCount: number;

  loadUser: () => Promise<void>;
  persistUser: () => Promise<void>;
  incrementScroll: () => Promise<number>;
  resetScrollCount: () => void;
  setPremium: (premium: boolean) => Promise<void>;
  shouldShowAd: () => boolean;
  setDarkMode: (dark: boolean) => Promise<void>;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  setCategories: (cats: string[]) => Promise<void>;
  setAutoRead: (enabled: boolean) => Promise<void>;
  setDailyReminder: (enabled: boolean) => Promise<void>;
  setOnboardingSeen: () => Promise<void>;
  setAuthCompleted: () => Promise<void>;
  toggleBookmark: (quoteId: string) => Promise<void>;
  isBookmarked: (quoteId: string) => boolean;
  setAuth: (user: { uid: string; displayName: string | null; email: string | null; photoURL: string | null } | null) => Promise<void>;
  setProfile: (displayName: string, username: string) => Promise<void>;
  updateStreak: (todayStr: string) => Promise<void>;
  startPremiumTrial: () => Promise<void>;
  isEffectivelyPremium: () => boolean;
  setFontSizeMultiplier: (mult: number) => Promise<void>;
  setFollowSystemDarkMode: (follow: boolean) => Promise<void>;
  clearNewBadge: () => void;
  checkTrialExpiry: () => void;
  addViewedQuote: (quoteId: string, quoteText: string, author: string, source: string, todayStr: string) => Promise<void>;
  getTodayViewedQuotes: () => string[];
  incrementGuestTrial: () => number;
  setShowOnboardingFlag: (show: boolean) => void;
  setNotificationHour: (hour: number) => Promise<void>;
  setNotificationHours: (hours: number[]) => Promise<void>;
  setTtsSpeed: (speed: number) => Promise<void>;
  rateQuote: (quoteId: string, rating: 'like' | 'dislike') => Promise<void>;
  setShowCommunityQuotes: (show: boolean) => Promise<void>;
  incrementCommunitySubmitCount: () => Promise<void>;
  /** Track which quote category the user just viewed (ring buffer of last 30) */
  trackCategoryView: (category: string) => void;
}

const USER_KEY = '@dailyglow_user_v1';
const VIEWED_QUOTES_KEY = '@dailyglow_viewed_quotes';
const ALL_VIEWED_KEY = '@dailyglow_all_viewed_quotes';

export const useUserStore = create<UserState>((set, get) => ({
  isPremium: false,
  scrollCount: 0,
  totalQuotesViewed: 0,
  isLoaded: false,
  isDarkMode: false,
  language: 'ko',
  selectedCategories: [],
  dailyReminderEnabled: false,
  autoReadEnabled: false,
  hasSeenOnboarding: false,
  hasCompletedAuth: false,
  bookmarkedQuoteIds: [],
  todayViewedQuoteIds: [],
  todayViewedDate: null,
  allViewedQuoteIds: [],
  showOnboardingFlag: false,
  uid: null,
  displayName: null,
  email: null,
  photoURL: null,
  username: null,
  currentStreak: 0,
  lastActiveDate: null,
  streakFreezeCount: 0,
  streakFreezeWeekKey: null,
  earnedBadges: [],
  newBadgeEarned: null,
  premiumTrialExpiry: null,
  premiumTrialUsed: false,
  quoteFontSizeMultiplier: 1.0,
  followSystemDarkMode: false,
  guestTrialCount: 0,
  notificationHour: 9,
  notificationHours: [8],
  ttsSpeed: 0.9,
  earnedBadgeDates: {},
  likedQuoteIds: [],
  dislikedQuoteIds: [],
  showCommunityQuotes: true,
  communitySubmitCount: 0,
  recentViewedCategories: [],
  followerCount: 0,
  followingCount: 0,

  loadUser: async () => {
    try {
      const raw = await AsyncStorage.getItem(USER_KEY);
      const viewedRaw = await AsyncStorage.getItem(VIEWED_QUOTES_KEY);
      const allViewedRaw = await AsyncStorage.getItem(ALL_VIEWED_KEY);
      let viewedData = { ids: [], date: null };
      if (viewedRaw) viewedData = JSON.parse(viewedRaw);
      const allViewed: string[] = allViewedRaw ? JSON.parse(allViewedRaw) : [];

      if (raw) {
        const d = JSON.parse(raw);
        const lang = d.language ?? 'ko';
        i18n.changeLanguage(lang);
        set({
          isPremium: d.isPremium ?? false,
          scrollCount: d.scrollCount ?? 0,
          totalQuotesViewed: d.totalQuotesViewed ?? 0,
          isDarkMode: d.isDarkMode ?? false,
          language: lang,
          selectedCategories: d.selectedCategories ?? [],
          dailyReminderEnabled: d.dailyReminderEnabled ?? false,
          autoReadEnabled: d.autoReadEnabled ?? false,
          hasSeenOnboarding: d.hasSeenOnboarding ?? false,
          hasCompletedAuth: d.hasCompletedAuth ?? false,
          bookmarkedQuoteIds: d.bookmarkedQuoteIds ?? [],
          todayViewedQuoteIds: viewedData.ids ?? [],
          todayViewedDate: viewedData.date ?? null,
          allViewedQuoteIds: allViewed,
          uid: d.uid ?? null,
          displayName: d.displayName ?? null,
          email: d.email ?? null,
          photoURL: d.photoURL ?? null,
          username: d.username ?? null,
          currentStreak: d.currentStreak ?? 0,
          lastActiveDate: d.lastActiveDate ?? null,
          streakFreezeCount: d.streakFreezeCount ?? 0,
          streakFreezeWeekKey: d.streakFreezeWeekKey ?? null,
          earnedBadges: d.earnedBadges ?? [],
          premiumTrialExpiry: d.premiumTrialExpiry ?? null,
          premiumTrialUsed: d.premiumTrialUsed ?? false,
          quoteFontSizeMultiplier: d.quoteFontSizeMultiplier ?? 1.0,
          followSystemDarkMode: d.followSystemDarkMode ?? false,
          notificationHour: d.notificationHour ?? 9,
          notificationHours: d.notificationHours ?? (d.notificationHour ? [d.notificationHour] : [8]),
          ttsSpeed: d.ttsSpeed ?? 0.9,
          earnedBadgeDates: d.earnedBadgeDates ?? {},
          likedQuoteIds: d.likedQuoteIds ?? [],
          dislikedQuoteIds: d.dislikedQuoteIds ?? [],
          showCommunityQuotes: d.showCommunityQuotes ?? true,
          communitySubmitCount: d.communitySubmitCount ?? 0,
          recentViewedCategories: d.recentViewedCategories ?? [],
          followerCount: d.followerCount ?? 0,
          followingCount: d.followingCount ?? 0,
          isLoaded: true,
        });
      } else {
        // First install — auto-detect device language
        const deviceLocale = Localization.getLocales()?.[0]?.languageCode ?? 'ko';
        const detectedLang = (LANGUAGES.find((l) => l.code === deviceLocale)?.code ?? 'ko') as LanguageCode;
        if (detectedLang !== 'ko') i18n.changeLanguage(detectedLang);
        set({ language: detectedLang, isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  persistUser: async () => {
    const s = get();
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify({
        isPremium: s.isPremium,
        scrollCount: s.scrollCount,
        totalQuotesViewed: s.totalQuotesViewed,
        isDarkMode: s.isDarkMode,
        language: s.language,
        selectedCategories: s.selectedCategories,
        dailyReminderEnabled: s.dailyReminderEnabled,
        autoReadEnabled: s.autoReadEnabled,
        hasSeenOnboarding: s.hasSeenOnboarding,
        hasCompletedAuth: s.hasCompletedAuth,
        bookmarkedQuoteIds: s.bookmarkedQuoteIds,
        uid: s.uid,
        displayName: s.displayName,
        email: s.email,
        photoURL: s.photoURL,
        username: s.username,
        currentStreak: s.currentStreak,
        lastActiveDate: s.lastActiveDate,
        streakFreezeCount: s.streakFreezeCount,
        streakFreezeWeekKey: s.streakFreezeWeekKey,
        earnedBadges: s.earnedBadges,
        premiumTrialExpiry: s.premiumTrialExpiry,
        premiumTrialUsed: s.premiumTrialUsed,
        quoteFontSizeMultiplier: s.quoteFontSizeMultiplier,
        followSystemDarkMode: s.followSystemDarkMode,
        notificationHour: s.notificationHour,
        notificationHours: s.notificationHours,
        ttsSpeed: s.ttsSpeed,
        earnedBadgeDates: s.earnedBadgeDates,
        likedQuoteIds: s.likedQuoteIds,
        dislikedQuoteIds: s.dislikedQuoteIds,
        showCommunityQuotes: s.showCommunityQuotes,
        communitySubmitCount: s.communitySubmitCount,
        recentViewedCategories: s.recentViewedCategories,
        followerCount: s.followerCount,
        followingCount: s.followingCount,
      }));
    } catch { /* silent */ }
  },

  incrementScroll: async () => {
    const n = get().scrollCount + 1;
    const t = get().totalQuotesViewed + 1;
    set({ scrollCount: n, totalQuotesViewed: t });
    // Award quotes-viewed badges
    const todayStr = new Date().toISOString().split('T')[0];
    const currentBadges = get().earnedBadges;
    const uid = get().uid;
    for (const threshold of QUOTE_BADGE_THRESHOLDS) {
      const badgeId = `quotes_${threshold}`;
      if (t >= threshold && !currentBadges.includes(badgeId)) {
        const next = [...get().earnedBadges, badgeId];
        const newDates = { ...get().earnedBadgeDates, [badgeId]: todayStr };
        appLog.log('[badge] quotes milestone earned', { uid, badgeId, total: t });
        set({ earnedBadges: next, newBadgeEarned: badgeId, earnedBadgeDates: newDates });
        if (uid) saveUserBadges(uid, next).catch(() => {});
        break;
      }
    }
    await get().persistUser();
    return n;
  },

  resetScrollCount: () => set({ scrollCount: 0 }),

  setPremium: async (premium) => {
    const uid = get().uid;
    set({ isPremium: premium });
    await get().persistUser();
    
    if (uid) {
      await updatePremiumStatus(uid, premium);
      await logActivity(uid, premium ? 'premium_purchased' : 'premium_cancelled');
    }
  },

  shouldShowAd: () => {
    const { isPremium, scrollCount } = get();
    if (isPremium) return false;
    return scrollCount > 0 && scrollCount % 5 === 0;
  },

  setDarkMode: async (dark) => {
    const uid = get().uid;
    set({ isDarkMode: dark });
    await get().persistUser();
    if (uid) saveUserSettings(uid, { isDarkMode: dark }).catch(() => {});
  },

  setLanguage: async (lang) => {
    const uid = get().uid;
    i18n.changeLanguage(lang);
    set({ language: lang });
    await get().persistUser();
    // Language is a local-only setting — intentionally NOT synced to Firestore.
    // Clear quote cache so next fetch uses the new language
    await clearQuoteCache();
    // Reset the quote store so the home screen reloads fresh quotes
    try {
      const { useQuoteStore } = require('./useQuoteStore');
      useQuoteStore.getState().setQuotes([]);
    } catch (err) { appLog.warn('[setLanguage] failed to reset quote store', { err: String(err) }); }
  },

  setCategories: async (cats) => {
    const uid = get().uid;
    set({ selectedCategories: cats });
    await get().persistUser();
    if (uid) saveUserSettings(uid, { selectedCategories: cats }).catch(() => {});
    await clearQuoteCache();
    try {
      const { useQuoteStore } = require('./useQuoteStore');
      useQuoteStore.getState().setQuotes([]);
    } catch (err) { appLog.warn('[setCategories] failed to reset quote store', { err: String(err) }); }
  },

  setAutoRead: async (enabled) => {
    const uid = get().uid;
    set({ autoReadEnabled: enabled });
    await get().persistUser();
    if (uid) saveUserSettings(uid, { autoReadEnabled: enabled }).catch(() => {});
  },

  setDailyReminder: async (enabled) => {
    const uid = get().uid;
    set({ dailyReminderEnabled: enabled });
    await get().persistUser();
    if (uid) saveUserSettings(uid, { dailyReminderEnabled: enabled }).catch(() => {});
  },

  setOnboardingSeen: async () => {
    set({ hasSeenOnboarding: true });
    await get().persistUser();
  },

  setAuthCompleted: async () => {
    set({ hasCompletedAuth: true });
    await get().persistUser();
  },

  setProfile: async (displayName, username) => {
    const uid = get().uid;
    const previousUsername = get().username ?? undefined;
    set({ displayName, username });
    await get().persistUser();
    if (uid) {
      await saveUserProfile(uid, displayName, username, previousUsername);
    }
  },

  toggleBookmark: async (quoteId) => {
    const uid = get().uid;
    const ids = get().bookmarkedQuoteIds;
    const isCurrentlyBookmarked = ids.includes(quoteId);
    const next = isCurrentlyBookmarked
      ? ids.filter((id) => id !== quoteId)
      : [...ids, quoteId];
    set({ bookmarkedQuoteIds: next });
    await get().persistUser();
    // Award bookmark badges
    if (!isCurrentlyBookmarked) {
      const todayStr = new Date().toISOString().split('T')[0];
      const currentBadges = get().earnedBadges;
      for (const threshold of BOOKMARK_BADGE_THRESHOLDS) {
        const badgeId = `bookmark_${threshold}`;
        if (next.length >= threshold && !currentBadges.includes(badgeId)) {
          const newBadges = [...get().earnedBadges, badgeId];
          const newDates = { ...get().earnedBadgeDates, [badgeId]: todayStr };
          appLog.log('[badge] bookmark badge earned', { uid, badgeId });
          set({ earnedBadges: newBadges, newBadgeEarned: badgeId, earnedBadgeDates: newDates });
          if (uid) saveUserBadges(uid, newBadges).catch(() => {});
          break;
        }
      }
    }
    if (uid) {
      saveBookmarkedQuotes(uid, next);
      logQuoteBookmarked(uid, quoteId, !isCurrentlyBookmarked);
    }
  },

  isBookmarked: (quoteId) => get().bookmarkedQuoteIds.includes(quoteId),

  setAuth: async (user) => {
    if (user) {
      set({ uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL });

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const [premiumStatus, cloudBookmarks, cloudTodayViewed, cloudSettings, cloudStreak, cloudUsername, socialProfile] = await Promise.all([
        fetchPremiumStatus(user.uid),
        fetchBookmarkedQuotes(user.uid),
        fetchViewedQuotesForDate(user.uid, todayStr),
        fetchUserSettings(user.uid),
        fetchStreakFromFirestore(user.uid),
        fetchUsername(user.uid),
        fetchPublicUserProfile(user.uid),
      ]);
      
      if (premiumStatus) {
        set({ isPremium: true });
      }
      
      if (cloudUsername) {
        set({ username: cloudUsername });
      }

      if (socialProfile) {
        set({ followerCount: socialProfile.followerCount, followingCount: socialProfile.followingCount });
      }
      
      if (cloudBookmarks.length > 0) {
        const localBookmarks = get().bookmarkedQuoteIds;
        const merged = [...new Set([...localBookmarks, ...cloudBookmarks])];
        set({ bookmarkedQuoteIds: merged });
      }

      // Restore today's viewed quotes from cloud
      if (cloudTodayViewed.length > 0) {
        const localToday = get().todayViewedDate === todayStr ? get().todayViewedQuoteIds : [];
        // Cloud IDs are plain q_ids; local entries may be "q_id|author|source|text" format
        const localIds = localToday.map((q) => q.split('|')[0]);
        const allIds = [...new Set([...localIds, ...cloudTodayViewed])];
        // Keep local entries (with full metadata) where available
        const localMap = new Map(localToday.map((e) => [e.split('|')[0], e]));
        // For cloud-only IDs, try to recover metadata from the quote store
        let quoteMap: Map<string, { text: string; author: string; source?: string }> = new Map();
        try {
          const { useQuoteStore } = require('./useQuoteStore');
          const quotes: Array<{ id: string; text: string; author: string; source?: string }> = useQuoteStore.getState().quotes;
          quotes.forEach((q) => quoteMap.set(q.id, { text: q.text, author: q.author, source: q.source }));
        } catch { /* silent */ }
        const merged = allIds.map((id) => {
          if (localMap.has(id)) return localMap.get(id)!;
          const meta = quoteMap.get(id);
          if (meta) return `${id}|${meta.author ?? ''}|${meta.source ?? ''}|${meta.text}`;
          return id; // fallback: plain id (will be hidden in MyScreen since text is empty)
        });
        set({ todayViewedQuoteIds: merged, todayViewedDate: todayStr });
        AsyncStorage.setItem(VIEWED_QUOTES_KEY, JSON.stringify({ ids: merged, date: todayStr })).catch(() => {});
      }

      // Restore streak from cloud (cloud wins if higher)
      if (cloudStreak) {
        const localStreak = get().currentStreak;
        if (cloudStreak.current > localStreak) {
          set({ currentStreak: cloudStreak.current, lastActiveDate: cloudStreak.lastActiveDate });
        }
      }

      // Restore saved preference settings from the cloud (language is local-only)
      if (cloudSettings) {
        set({
          ...(cloudSettings.isDarkMode != null && { isDarkMode: cloudSettings.isDarkMode }),
          ...(cloudSettings.selectedCategories != null && { selectedCategories: cloudSettings.selectedCategories }),
          ...(cloudSettings.autoReadEnabled != null && { autoReadEnabled: cloudSettings.autoReadEnabled }),
          ...(cloudSettings.dailyReminderEnabled != null && { dailyReminderEnabled: cloudSettings.dailyReminderEnabled }),
        });
      }
    } else {
      // Logout: clear all user-specific data so the next user starts clean.
      // earnedBadges and premiumTrial* are deliberately NOT cleared — they are
      // device-side achievements and should survive a re-login.
      set({
        uid: null, displayName: null, email: null, photoURL: null, username: null,
        isPremium: false,
        followerCount: 0,
        followingCount: 0,
        bookmarkedQuoteIds: [],
        todayViewedQuoteIds: [],
        todayViewedDate: null,
        allViewedQuoteIds: [],
        currentStreak: 0,
        lastActiveDate: null,
        streakFreezeCount: 0,
        streakFreezeWeekKey: null,
        newBadgeEarned: null,
      });
      // Clear local viewed-quotes caches
      AsyncStorage.removeItem(VIEWED_QUOTES_KEY).catch(() => {});
      AsyncStorage.removeItem(ALL_VIEWED_KEY).catch(() => {});
    }
    await get().persistUser();
  },

  updateStreak: async (todayStr) => {
    const { lastActiveDate, currentStreak, uid } = get();
    if (lastActiveDate === todayStr) return;

    // Replenish streak freeze if this is a new ISO week
    const thisWeekKey = getISOWeekKey(todayStr);
    if (get().streakFreezeWeekKey !== thisWeekKey) {
      appLog.log('[streak] new week — freeze replenished', { uid, weekKey: thisWeekKey });
      set({ streakFreezeCount: 1, streakFreezeWeekKey: thisWeekKey });
    }

    const daysSince = dateDiffInDays(lastActiveDate, todayStr);
    let newStreak: number;

    if (daysSince === 1) {
      newStreak = currentStreak + 1;
    } else if (daysSince === 2 && get().streakFreezeCount > 0) {
      // Auto-apply streak freeze for exactly one missed day
      appLog.log('[streak] freeze auto-applied', { uid, daysSince });
      set({ streakFreezeCount: get().streakFreezeCount - 1 });
      newStreak = currentStreak + 1;
    } else {
      appLog.log('[streak] reset', { uid, daysSince, prev: currentStreak });
      newStreak = 1;
    }

    set({ currentStreak: newStreak, lastActiveDate: todayStr });
    appLog.log('[streak] updated', { uid, newStreak, daysSince });

    // Award streak milestones
    const currentBadges = get().earnedBadges;
    for (const threshold of STREAK_BADGE_THRESHOLDS) {
      const badgeId = `streak_${threshold}`;
      if (newStreak >= threshold && !currentBadges.includes(badgeId)) {
        const next = [...get().earnedBadges, badgeId];
        const newDates = { ...get().earnedBadgeDates, [badgeId]: todayStr };
        appLog.log('[badge] milestone earned', { uid, badgeId, streak: newStreak });
        set({ earnedBadges: next, newBadgeEarned: badgeId, earnedBadgeDates: newDates });
        if (uid) saveUserBadges(uid, next).catch(() => {});
        break; // award at most one badge per streak update
      }
    }

    await get().persistUser();
    if (uid) saveStreakToFirestore(uid, newStreak, todayStr).catch(() => {});

    // Reschedule smart notifications so the near-milestone 08:30 slot is
    // added or removed correctly based on the updated streak value.
    const { dailyReminderEnabled, displayName } = get();
    if (dailyReminderEnabled) {
      scheduleSmartNotifications({
        dailyReminderEnabled: true,
        uid: uid ?? undefined,
        userName: displayName ?? undefined,
        currentStreak: newStreak,
      }).catch(() => {});
    }
  },

  startPremiumTrial: async () => {
    if (get().premiumTrialUsed) return;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    const expiryStr = expiry.toISOString().split('T')[0];
    appLog.log('[premium] trial started', { uid: get().uid, expiry: expiryStr });
    set({ premiumTrialExpiry: expiryStr, premiumTrialUsed: true });
    await get().persistUser();
  },

  isEffectivelyPremium: () => {
    const { isPremium, premiumTrialExpiry } = get();
    if (isPremium) return true;
    if (premiumTrialExpiry) {
      return new Date() < new Date(premiumTrialExpiry + 'T23:59:59');
    }
    return false;
  },

  setFontSizeMultiplier: async (mult) => {
    set({ quoteFontSizeMultiplier: mult });
    await get().persistUser();
  },

  setFollowSystemDarkMode: async (follow) => {
    set({ followSystemDarkMode: follow });
    await get().persistUser();
  },

  clearNewBadge: () => {
    set({ newBadgeEarned: null });
  },

  checkTrialExpiry: () => {
    const { premiumTrialExpiry, isPremium } = get();
    if (!isPremium && premiumTrialExpiry) {
      if (new Date() > new Date(premiumTrialExpiry + 'T23:59:59')) {
        // Trial expired; leave premiumTrialUsed=true so they can't re-activate
      }
    }
  },

  addViewedQuote: async (quoteId, quoteText, author, source, todayStr) => {
    const { todayViewedDate, todayViewedQuoteIds, allViewedQuoteIds, uid } = get();
    // Guest mode: viewed quotes are not persisted (no uid, no sync).
    if (!uid) return;
    let newIds: string[];
    // Format: "quoteId|author|source|quoteText" (quoteText is last, may contain |)
    const entry = `${quoteId}|${author ?? ''}|${source ?? ''}|${quoteText}`;

    if (todayViewedDate !== todayStr) {
      newIds = [entry];
    } else {
      if (todayViewedQuoteIds.some((q) => q.startsWith(quoteId))) return;
      newIds = [...todayViewedQuoteIds, entry];
    }

    // Accumulate all-time viewed IDs (q_id only)
    const needsAllViewedUpdate = !allViewedQuoteIds.includes(quoteId);
    const newAllViewed = needsAllViewedUpdate ? [...allViewedQuoteIds, quoteId] : allViewedQuoteIds;

    set({ todayViewedQuoteIds: newIds, todayViewedDate: todayStr, allViewedQuoteIds: newAllViewed });
    try {
      await AsyncStorage.setItem(VIEWED_QUOTES_KEY, JSON.stringify({ ids: newIds, date: todayStr }));
    } catch { /* silent */ }
    if (needsAllViewedUpdate) {
      AsyncStorage.setItem(ALL_VIEWED_KEY, JSON.stringify(newAllViewed)).catch(() => {});
    }
    // Persist to Firebase (fire-and-forget) — save today's viewed IDs keyed by date
    if (uid) {
      const todayIdsOnly = newIds.map((q) => q.split('|')[0]);
      saveViewedQuotesForDate(uid, todayStr, todayIdsOnly).catch(() => {});
    }
  },

  getTodayViewedQuotes: () => {
    return get().todayViewedQuoteIds;
  },
  
  incrementGuestTrial: () => {
    const newCount = get().guestTrialCount + 1;
    set({ guestTrialCount: newCount });
    return newCount;
  },
  
  setShowOnboardingFlag: (show) => {
    set({ showOnboardingFlag: show });
  },

  setNotificationHour: async (hour) => {
    set({ notificationHour: hour });
    await get().persistUser();
  },

  setNotificationHours: async (hours) => {
    set({ notificationHours: hours, notificationHour: hours[0] ?? 8 });
    await get().persistUser();
  },

  setTtsSpeed: async (speed) => {
    appLog.log('[settings] ttsSpeed changed', { speed });
    set({ ttsSpeed: speed });
    await get().persistUser();
  },

  rateQuote: async (quoteId, rating) => {
    const uid = get().uid;
    const liked = get().likedQuoteIds;
    const disliked = get().dislikedQuoteIds;
    let newLiked = liked;
    let newDisliked = disliked;
    if (rating === 'like') {
      newLiked = liked.includes(quoteId) ? liked.filter((id) => id !== quoteId) : [...liked, quoteId];
      newDisliked = disliked.filter((id) => id !== quoteId);
    } else {
      newDisliked = disliked.includes(quoteId) ? disliked.filter((id) => id !== quoteId) : [...disliked, quoteId];
      newLiked = liked.filter((id) => id !== quoteId);
    }
    appLog.log('[quote] rated', { quoteId, rating, uid });
    set({ likedQuoteIds: newLiked, dislikedQuoteIds: newDisliked });
    await get().persistUser();
    if (uid) saveQuoteRating(uid, quoteId, rating).catch(() => {});
  },

  setShowCommunityQuotes: async (show) => {
    set({ showCommunityQuotes: show });
    await get().persistUser();
  },

  incrementCommunitySubmitCount: async () => {
    const newCount = get().communitySubmitCount + 1;
    set({ communitySubmitCount: newCount });
    const todayStr = new Date().toISOString().split('T')[0];
    const currentBadges = get().earnedBadges;
    const uid = get().uid;
    if (newCount >= 5 && !currentBadges.includes('community_5')) {
      const newBadges = [...get().earnedBadges, 'community_5'];
      const newDates = { ...get().earnedBadgeDates, community_5: todayStr };
      appLog.log('[badge] community_5 earned', { uid, total: newCount });
      set({ earnedBadges: newBadges, newBadgeEarned: 'community_5', earnedBadgeDates: newDates });
      if (uid) saveUserBadges(uid, newBadges).catch(() => {});
    }
    await get().persistUser();
  },

  trackCategoryView: (category) => {
    if (!category) return;
    const { uid, recentViewedCategories } = get();
    const updated = [...recentViewedCategories, category].slice(-30); // ring buffer capped at 30
    set({ recentViewedCategories: updated });
    // Fire-and-forget sync to Firestore (only when logged in)
    if (uid) saveUserSettings(uid, { recentViewedCategories: updated }).catch(() => {});
  },
}));
