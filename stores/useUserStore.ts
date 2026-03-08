import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import type { LanguageCode } from '../i18n';
import { clearQuoteCache } from '../services/quoteService';
import { updatePremiumStatus, fetchPremiumStatus, logActivity, saveBookmarkedQuotes, fetchBookmarkedQuotes, logQuoteBookmarked, saveViewedQuotesForDate, fetchViewedQuotesForDate, saveStreakToFirestore, fetchStreakFromFirestore, saveUserSettings, fetchUserSettings } from '../services/firestoreUserService';

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

  // Streak
  currentStreak: number;
  lastActiveDate: string | null;
  
  // Guest trial
  guestTrialCount: number;

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
  updateStreak: (todayStr: string) => Promise<void>;
  addViewedQuote: (quoteId: string, quoteText: string, author: string, source: string, todayStr: string) => Promise<void>;
  getTodayViewedQuotes: () => string[];
  incrementGuestTrial: () => number;
  setShowOnboardingFlag: (show: boolean) => void;
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
  currentStreak: 0,
  lastActiveDate: null,
  guestTrialCount: 0,

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
          currentStreak: d.currentStreak ?? 0,
          lastActiveDate: d.lastActiveDate ?? null,
          isLoaded: true,
        });
      } else {
        set({ isLoaded: true });
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
        currentStreak: s.currentStreak,
        lastActiveDate: s.lastActiveDate,
      }));
    } catch { /* silent */ }
  },

  incrementScroll: async () => {
    const n = get().scrollCount + 1;
    const t = get().totalQuotesViewed + 1;
    set({ scrollCount: n, totalQuotesViewed: t });
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
    } catch { /* silent */ }
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
    } catch { /* silent */ }
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

  toggleBookmark: async (quoteId) => {
    const uid = get().uid;
    const ids = get().bookmarkedQuoteIds;
    const isCurrentlyBookmarked = ids.includes(quoteId);
    const next = isCurrentlyBookmarked
      ? ids.filter((id) => id !== quoteId)
      : [...ids, quoteId];
    set({ bookmarkedQuoteIds: next });
    await get().persistUser();
    
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

      const [premiumStatus, cloudBookmarks, cloudTodayViewed, cloudSettings, cloudStreak] = await Promise.all([
        fetchPremiumStatus(user.uid),
        fetchBookmarkedQuotes(user.uid),
        fetchViewedQuotesForDate(user.uid, todayStr),
        fetchUserSettings(user.uid),
        fetchStreakFromFirestore(user.uid),
      ]);
      
      if (premiumStatus) {
        set({ isPremium: true });
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
        // Keep local entries (with full metadata) where available, or use plain id for cloud-only entries
        const localMap = new Map(localToday.map((e) => [e.split('|')[0], e]));
        const merged = allIds.map((id) => localMap.get(id) ?? id);
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
      // Logout: clear all user-specific data so the next user starts clean
      set({
        uid: null, displayName: null, email: null, photoURL: null,
        isPremium: false,
        bookmarkedQuoteIds: [],
        todayViewedQuoteIds: [],
        todayViewedDate: null,
        allViewedQuoteIds: [],
        currentStreak: 0,
        lastActiveDate: null,
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

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const newStreak = lastActiveDate === yStr ? currentStreak + 1 : 1;
    set({ currentStreak: newStreak, lastActiveDate: todayStr });
    await get().persistUser();
    // Sync to Firestore (fire-and-forget)
    if (uid) saveStreakToFirestore(uid, newStreak, todayStr).catch(() => {});
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
}));
