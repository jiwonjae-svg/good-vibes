import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import {
  fetchApprovedCommunityQuotes,
  likeCommunityQuote,
  unlikeCommunityQuote,
  fetchLikedIds,
  submitCommunityQuote,
  reportCommunityQuote,
  checkServerRateLimit,
  recordServerSubmission,
  type CommunityQuote,
} from '../services/communityService';
import { appLog } from '../services/logger';

export type FeedMode = 'all' | 'community';
export type SortBy = 'latest' | 'likes';

const RATE_LIMIT_KEY = '@community_submission_times';
const REPORTED_KEY = '@community_reported_ids';
const SORT_KEY = '@community_sort_by';

async function loadPersistedTimes(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return [];
    const all: number[] = JSON.parse(raw);
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return all.filter((t) => t > cutoff);
  } catch {
    return [];
  }
}

async function savePersistedTimes(times: number[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(times));
  } catch {}
}

async function loadReportedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(REPORTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveReportedIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(REPORTED_KEY, JSON.stringify(ids));
  } catch {}
}

interface CommunityState {
  feedMode: FeedMode;
  sortBy: SortBy;
  communityQuotes: CommunityQuote[];
  likedCommunityIds: string[];
  reportedCommunityIds: string[];
  isLoading: boolean;
  hasMore: boolean;
  lastCursor: QueryDocumentSnapshot<DocumentData> | null;

  // Submission rate limit: track timestamps of recent submissions (persisted to AsyncStorage)
  recentSubmissionTimes: number[];

  init: () => Promise<void>;
  setFeedMode: (mode: FeedMode) => void;
  setSortBy: (sort: SortBy) => void;
  loadCommunityQuotes: (language: string, uid?: string, reset?: boolean) => Promise<void>;
  loadMore: (language: string, uid?: string) => Promise<void>;
  toggleLike: (uid: string, quoteId: string) => Promise<void>;
  submitQuote: (
    uid: string,
    submitterName: string,
    text: string,
    author: string,
    language: string,
    categories: string[],
  ) => Promise<{ success: boolean; error?: string }>;
  reportQuote: (uid: string, quoteId: string, reason: string) => Promise<void>;
  canSubmit: () => boolean;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  feedMode: 'all',
  sortBy: 'latest',
  communityQuotes: [],
  likedCommunityIds: [],
  reportedCommunityIds: [],
  isLoading: false,
  hasMore: true,
  lastCursor: null,
  recentSubmissionTimes: [],

  init: async () => {
    const [times, reportedIds, storedSort] = await Promise.all([
      loadPersistedTimes(),
      loadReportedIds(),
      AsyncStorage.getItem(SORT_KEY).catch(() => null),
    ]);
    set({
      recentSubmissionTimes: times,
      reportedCommunityIds: reportedIds,
      sortBy: (storedSort as SortBy) ?? 'latest',
    });
  },

  setFeedMode: (mode) => set({ feedMode: mode }),

  setSortBy: async (sort) => {
    set({ sortBy: sort, communityQuotes: [], lastCursor: null, hasMore: true });
    await AsyncStorage.setItem(SORT_KEY, sort).catch(() => {});
  },

  loadCommunityQuotes: async (language, uid, reset = false) => {
    const { isLoading, sortBy } = get();
    if (isLoading && !reset) return;
    set({ isLoading: true });
    if (reset) set({ communityQuotes: [], lastCursor: null, hasMore: true });

    try {
      const { quotes, lastDoc } = await fetchApprovedCommunityQuotes(language, 20, null, sortBy);

      let likedIds: string[] = get().likedCommunityIds;
      if (uid && quotes.length > 0) {
        try {
          likedIds = await fetchLikedIds(uid, quotes.map((q) => q.id));
        } catch (e) {
          appLog.warn('[communityStore] fetchLikedIds failed', e);
        }
      }

      set({
        communityQuotes: quotes,
        lastCursor: lastDoc,
        hasMore: quotes.length === 20,
        likedCommunityIds: likedIds,
        isLoading: false,
      });
    } catch (e) {
      appLog.error('[communityStore] load failed', e);
      set({ isLoading: false });
    }
  },

  loadMore: async (language, uid) => {
    const { isLoading, hasMore, lastCursor, sortBy } = get();
    if (isLoading || !hasMore) return;
    set({ isLoading: true });

    try {
      const { quotes, lastDoc } = await fetchApprovedCommunityQuotes(language, 20, lastCursor, sortBy);

      let newLikedIds: string[] = [];
      if (uid && quotes.length > 0) {
        try {
          newLikedIds = await fetchLikedIds(uid, quotes.map((q) => q.id));
        } catch (e) {
          appLog.warn('[communityStore] fetchLikedIds (loadMore) failed', e);
        }
      }

      set((s) => ({
        communityQuotes: [...s.communityQuotes, ...quotes],
        lastCursor: lastDoc,
        hasMore: quotes.length === 20,
        likedCommunityIds: uid && newLikedIds.length > 0
          ? Array.from(new Set([...s.likedCommunityIds, ...newLikedIds]))
          : s.likedCommunityIds,
        isLoading: false,
      }));
    } catch {
      set({ isLoading: false });
    }
  },

  toggleLike: async (uid, quoteId) => {
    const isLiked = get().likedCommunityIds.includes(quoteId);

    // Optimistic update
    set((s) => ({
      likedCommunityIds: isLiked
        ? s.likedCommunityIds.filter((id) => id !== quoteId)
        : [...s.likedCommunityIds, quoteId],
      communityQuotes: s.communityQuotes.map((q) =>
        q.id === quoteId ? { ...q, likeCount: q.likeCount + (isLiked ? -1 : 1) } : q,
      ),
    }));

    try {
      if (isLiked) {
        await unlikeCommunityQuote(uid, quoteId);
      } else {
        await likeCommunityQuote(uid, quoteId);
      }
    } catch {
      // Revert on failure
      set((s) => ({
        likedCommunityIds: isLiked
          ? [...s.likedCommunityIds, quoteId]
          : s.likedCommunityIds.filter((id) => id !== quoteId),
        communityQuotes: s.communityQuotes.map((q) =>
          q.id === quoteId ? { ...q, likeCount: q.likeCount + (isLiked ? 1 : -1) } : q,
        ),
      }));
    }
  },

  submitQuote: async (uid, submitterName, text, author, language, categories) => {
    // Server-side rate limit check (Firestore) takes priority over local AsyncStorage cache
    const serverBlocked = await checkServerRateLimit(uid);
    if (serverBlocked) {
      return { success: false, error: 'rateLimit' };
    }

    const result = await submitCommunityQuote(uid, submitterName, text, author, language, categories);
    if (result.success) {
      // Record server-side submission timestamp
      await recordServerSubmission(uid);
      // Keep local AsyncStorage in sync as a fast offline cache
      const updated = [...get().recentSubmissionTimes, Date.now()];
      set({ recentSubmissionTimes: updated });
      await savePersistedTimes(updated);
    }
    return result;
  },

  reportQuote: async (uid, quoteId, reason) => {
    await reportCommunityQuote(uid, quoteId, reason);
    const updated = [...get().reportedCommunityIds, quoteId];
    set({ reportedCommunityIds: updated });
    await saveReportedIds(updated);
  },

  canSubmit: () => {
    const { recentSubmissionTimes } = get();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = recentSubmissionTimes.filter((t) => t > cutoff);
    return recent.length < 3;
  },
}));
