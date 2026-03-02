import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import type { LanguageCode } from '../i18n';
import { clearQuoteCache } from '../services/quoteService';
import { updatePremiumStatus, fetchPremiumStatus, logActivity, saveBookmarkedQuotes, fetchBookmarkedQuotes, logQuoteBookmarked } from '../services/firestoreUserService';

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
  addViewedQuote: (quoteId: string, quoteText: string, todayStr: string) => Promise<void>;
  getTodayViewedQuotes: () => string[];
  incrementGuestTrial: () => number;
  setShowOnboardingFlag: (show: boolean) => void;
}

const USER_KEY = '@dailyglow_user_v1';
const VIEWED_QUOTES_KEY = '@dailyglow_viewed_quotes';

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
      let viewedData = { ids: [], date: null };
      if (viewedRaw) viewedData = JSON.parse(viewedRaw);

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
    set({ isDarkMode: dark });
    await get().persistUser();
  },

  setLanguage: async (lang) => {
    i18n.changeLanguage(lang);
    set({ language: lang });
    await get().persistUser();
    // Clear quote cache so next fetch uses the new language
    await clearQuoteCache();
    // Reset the quote store so the home screen reloads fresh quotes
    try {
      const { useQuoteStore } = require('./useQuoteStore');
      useQuoteStore.getState().setQuotes([]);
    } catch { /* silent */ }
  },

  setCategories: async (cats) => {
    set({ selectedCategories: cats });
    await get().persistUser();
    await clearQuoteCache();
    try {
      const { useQuoteStore } = require('./useQuoteStore');
      useQuoteStore.getState().setQuotes([]);
    } catch { /* silent */ }
  },

  setAutoRead: async (enabled) => {
    set({ autoReadEnabled: enabled });
    await get().persistUser();
  },

  setDailyReminder: async (enabled) => {
    set({ dailyReminderEnabled: enabled });
    await get().persistUser();
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
      
      const [premiumStatus, cloudBookmarks] = await Promise.all([
        fetchPremiumStatus(user.uid),
        fetchBookmarkedQuotes(user.uid),
      ]);
      
      if (premiumStatus) {
        set({ isPremium: true });
      }
      
      if (cloudBookmarks.length > 0) {
        const localBookmarks = get().bookmarkedQuoteIds;
        const merged = [...new Set([...localBookmarks, ...cloudBookmarks])];
        set({ bookmarkedQuoteIds: merged });
      }
    } else {
      set({ uid: null, displayName: null, email: null, photoURL: null, isPremium: false });
    }
    await get().persistUser();
  },

  updateStreak: async (todayStr) => {
    const { lastActiveDate, currentStreak } = get();
    if (lastActiveDate === todayStr) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const newStreak = lastActiveDate === yStr ? currentStreak + 1 : 1;
    set({ currentStreak: newStreak, lastActiveDate: todayStr });
    await get().persistUser();
  },

  addViewedQuote: async (quoteId, quoteText, todayStr) => {
    const { todayViewedDate, todayViewedQuoteIds } = get();
    let newIds: string[];

    if (todayViewedDate !== todayStr) {
      newIds = [`${quoteId}|${quoteText}`];
    } else {
      if (todayViewedQuoteIds.some((q) => q.startsWith(quoteId))) return;
      newIds = [...todayViewedQuoteIds, `${quoteId}|${quoteText}`];
    }

    set({ todayViewedQuoteIds: newIds, todayViewedDate: todayStr });
    try {
      await AsyncStorage.setItem(VIEWED_QUOTES_KEY, JSON.stringify({ ids: newIds, date: todayStr }));
    } catch { /* silent */ }
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
