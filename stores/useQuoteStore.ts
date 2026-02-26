import { create } from 'zustand';

export interface Quote {
  id: string;
  text: string;
  author: string;
  category?: string;
  createdAt: number;
  gradientIndex: number;
}

interface QuoteState {
  quotes: Quote[];
  currentIndex: number;
  isLoading: boolean;
  isGenerating: boolean;

  setQuotes: (quotes: Quote[]) => void;
  appendQuotes: (quotes: Quote[]) => void;
  setCurrentIndex: (index: number) => void;
  setIsLoading: (loading: boolean) => void;
  setIsGenerating: (generating: boolean) => void;
  clearQuotes: () => void;
}

export const useQuoteStore = create<QuoteState>((set) => ({
  quotes: [],
  currentIndex: 0,
  isLoading: true,
  isGenerating: false,

  setQuotes: (quotes) => set({ quotes }),
  appendQuotes: (newQuotes) =>
    set((state) => ({ quotes: [...state.quotes, ...newQuotes] })),
  setCurrentIndex: (index) => set({ currentIndex: index }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsGenerating: (generating) => set({ isGenerating: generating }),
  clearQuotes: () => set({ quotes: [], currentIndex: 0 }),
}));
