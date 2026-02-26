import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import type { LanguageCode } from '../i18n';
import { clearQuoteCache } from '../services/quoteService';

export type QuoteCategory = 'all' | 'love' | 'growth' | 'life' | 'morning' | 'courage' | 'happiness' | 'patience' | 'wisdom' | 'friendship' | 'success';

interface UserState {
  isPremium: boolean;
  scrollCount: number;
  totalQuotesViewed: number;
  isLoaded: boolean;
  isDarkMode: boolean;
  language: LanguageCode;
  category: QuoteCategory;
  dailyReminderEnabled: boolean;
  hasSeenOnboarding: boolean;
  hasCompletedAuth: boolean;
  bookmarkedQuoteIds: string[];

  // Auth
  uid: string | null;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;

  // Streak
  currentStreak: number;
  lastActiveDate: string | null;

  loadUser: () => Promise<void>;
  persistUser: () => Promise<void>;
  incrementScroll: () => Promise<number>;
  resetScrollCount: () => void;
  setPremium: (premium: boolean) => Promise<void>;
  shouldShowAd: () => boolean;
  setDarkMode: (dark: boolean) => Promise<void>;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  setCategory: (cat: QuoteCategory) => Promise<void>;
  setDailyReminder: (enabled: boolean) => Promise<void>;
  setOnboardingSeen: () => Promise<void>;
  setAuthCompleted: () => Promise<void>;
  toggleBookmark: (quoteId: string) => Promise<void>;
  isBookmarked: (quoteId: string) => boolean;
  setAuth: (user: { uid: string; displayName: string | null; email: string | null; photoURL: string | null } | null) => Promise<void>;
  updateStreak: (todayStr: string) => Promise<void>;
}

const USER_KEY = '@good_vibe_user_v2';

export const useUserStore = create<UserState>((set, get) => ({
  isPremium: false,
  scrollCount: 0,
  totalQuotesViewed: 0,
  isLoaded: false,
  isDarkMode: false,
  language: 'ko',
  category: 'all',
  dailyReminderEnabled: false,
  hasSeenOnboarding: false,
  hasCompletedAuth: false,
  bookmarkedQuoteIds: [],
  uid: null,
  displayName: null,
  email: null,
  photoURL: null,
  currentStreak: 0,
  lastActiveDate: null,

  loadUser: async () => {
    try {
      const raw = await AsyncStorage.getItem(USER_KEY);
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
          category: d.category ?? 'all',
          dailyReminderEnabled: d.dailyReminderEnabled ?? false,
          hasSeenOnboarding: d.hasSeenOnboarding ?? false,
          hasCompletedAuth: d.hasCompletedAuth ?? false,
          bookmarkedQuoteIds: d.bookmarkedQuoteIds ?? [],
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
        category: s.category,
        dailyReminderEnabled: s.dailyReminderEnabled,
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
    set({ isPremium: premium });
    await get().persistUser();
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

  setCategory: async (cat) => {
    set({ category: cat });
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
    const ids = get().bookmarkedQuoteIds;
    const next = ids.includes(quoteId)
      ? ids.filter((id) => id !== quoteId)
      : [...ids, quoteId];
    set({ bookmarkedQuoteIds: next });
    await get().persistUser();
  },

  isBookmarked: (quoteId) => get().bookmarkedQuoteIds.includes(quoteId),

  setAuth: async (user) => {
    if (user) {
      set({ uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL });
    } else {
      set({ uid: null, displayName: null, email: null, photoURL: null });
    }
    await get().persistUser();
  },

  updateStreak: async (todayStr) => {
    const { lastActiveDate, currentStreak } = get();
    if (lastActiveDate === todayStr) return; // already counted today

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const newStreak = lastActiveDate === yStr ? currentStreak + 1 : 1;
    set({ currentStreak: newStreak, lastActiveDate: todayStr });
    await get().persistUser();
  },
}));
