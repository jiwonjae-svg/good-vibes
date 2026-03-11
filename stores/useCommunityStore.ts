import { create } from 'zustand';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import {
  fetchApprovedCommunityQuotes,
  likeCommunityQuote,
  unlikeCommunityQuote,
  fetchLikedIds,
  submitCommunityQuote,
  reportCommunityQuote,
  type CommunityQuote,
} from '../services/communityService';
import { appLog } from '../services/logger';

export type FeedMode = 'all' | 'community';

interface CommunityState {
  feedMode: FeedMode;
  communityQuotes: CommunityQuote[];
  likedCommunityIds: string[];
  isLoading: boolean;
  hasMore: boolean;
  lastCursor: QueryDocumentSnapshot<DocumentData> | null;

  // Submission rate limit: track timestamps of recent submissions (persisted in memory only)
  recentSubmissionTimes: number[];

  setFeedMode: (mode: FeedMode) => void;
  loadCommunityQuotes: (language: string, reset?: boolean) => Promise<void>;
  loadMore: (language: string) => Promise<void>;
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
  communityQuotes: [],
  likedCommunityIds: [],
  isLoading: false,
  hasMore: true,
  lastCursor: null,
  recentSubmissionTimes: [],

  setFeedMode: (mode) => set({ feedMode: mode }),

  loadCommunityQuotes: async (language, reset = false) => {
    const { isLoading } = get();
    if (isLoading && !reset) return;
    set({ isLoading: true });
    if (reset) set({ communityQuotes: [], lastCursor: null, hasMore: true });

    try {
      const { quotes, lastDoc } = await fetchApprovedCommunityQuotes(language, 20, null);
      const uid = undefined; // Caller passes uid if they want personalized likes

      set({
        communityQuotes: quotes,
        lastCursor: lastDoc,
        hasMore: quotes.length === 20,
        isLoading: false,
      });
    } catch (e) {
      appLog.error('[communityStore] load failed', e);
      set({ isLoading: false });
    }
  },

  loadMore: async (language) => {
    const { isLoading, hasMore, lastCursor } = get();
    if (isLoading || !hasMore) return;
    set({ isLoading: true });

    try {
      const { quotes, lastDoc } = await fetchApprovedCommunityQuotes(language, 20, lastCursor);
      set((s) => ({
        communityQuotes: [...s.communityQuotes, ...quotes],
        lastCursor: lastDoc,
        hasMore: quotes.length === 20,
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
    const result = await submitCommunityQuote(uid, submitterName, text, author, language, categories);
    if (result.success) {
      set((s) => ({
        recentSubmissionTimes: [...s.recentSubmissionTimes, Date.now()],
      }));
    }
    return result;
  },

  reportQuote: async (uid, quoteId, reason) => {
    await reportCommunityQuote(uid, quoteId, reason);
  },

  canSubmit: () => {
    const { recentSubmissionTimes } = get();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = recentSubmissionTimes.filter((t) => t > cutoff);
    return recent.length < 3;
  },
}));
