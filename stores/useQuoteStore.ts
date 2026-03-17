import { create } from 'zustand';

export interface Quote {
  id: string;
  text: string;
  author: string;
  source?: string;   // 'quotable' | 'wikiquote' | 'gutenberg' | 'community'
  category?: string;
  createdAt: number;
  gradientIndex: number;
  // Community-submitted quote fields
  submitterId?: string;
  submitterName?: string;
  submitterPhotoURL?: string | null;
}

interface QuoteState {
  quotes: Quote[];
  currentIndex: number;
  isLoading: boolean;
  isGenerating: boolean;
  /** Set by app/quote.tsx deep link route to notify the home screen reactively */
  pendingDeepLinkQuoteId: string | null;

  setQuotes: (quotes: Quote[]) => void;
  appendQuotes: (quotes: Quote[]) => void;
  setCurrentIndex: (index: number) => void;
  setIsLoading: (loading: boolean) => void;
  setIsGenerating: (generating: boolean) => void;
  clearQuotes: () => void;
  setPendingDeepLinkQuoteId: (id: string | null) => void;
}

export const useQuoteStore = create<QuoteState>((set) => ({
  quotes: [],
  currentIndex: 0,
  isLoading: true,
  isGenerating: false,
  pendingDeepLinkQuoteId: null,

  setQuotes: (quotes) => set({ quotes }),
  appendQuotes: (newQuotes) =>
    set((state) => ({ quotes: [...state.quotes, ...newQuotes] })),
  setCurrentIndex: (index) => set({ currentIndex: index }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsGenerating: (generating) => set({ isGenerating: generating }),
  clearQuotes: () => set({ quotes: [], currentIndex: 0 }),
  setPendingDeepLinkQuoteId: (id) => set({ pendingDeepLinkQuoteId: id }),
}));
