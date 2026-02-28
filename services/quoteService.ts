import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateQuotes } from './grokApi';
import { getQuotesByLanguage, seedQuotes } from '../data/seedQuotes';
import { LightColors } from '../constants/theme';
import { useUserStore } from '../stores/useUserStore';
import type { Quote } from '../stores/useQuoteStore';
import i18n from '../i18n';

const CACHE_KEY = '@dailyglow_quotes_cache';
const BATCH_SIZE = 5;
let usedSeedIndices = new Map<string, Set<number>>();

function makeQuote(text: string, author: string, category?: string): Quote {
  return {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    author,
    category,
    createdAt: Date.now(),
    gradientIndex: Math.floor(Math.random() * LightColors.cardGradients.length),
  };
}

function getSelectedCategories(): string[] {
  return useUserStore.getState().selectedCategories ?? [];
}

export async function fetchQuoteBatch(): Promise<Quote[]> {
  try {
    const rawQuotes = await generateQuotes(BATCH_SIZE, getSelectedCategories());
    const quotes = rawQuotes.map((q) => makeQuote(q.text, q.author, q.category));
    await cacheQuotes(quotes);
    return quotes;
  } catch {
    return getOfflineQuotes(BATCH_SIZE);
  }
}

function getOfflineQuotes(count: number): Quote[] {
  const lang = i18n.language;
  let langQuotes = getQuotesByLanguage(lang);

  if (langQuotes.length === 0) {
    langQuotes = getQuotesByLanguage('en');
  }
  if (langQuotes.length === 0) {
    langQuotes = seedQuotes;
  }

  if (!usedSeedIndices.has(lang)) {
    usedSeedIndices.set(lang, new Set());
  }
  const usedSet = usedSeedIndices.get(lang)!;

  const quotes: Quote[] = [];
  for (let i = 0; i < count; i++) {
    if (usedSet.size >= langQuotes.length) usedSet.clear();
    let idx: number;
    do {
      idx = Math.floor(Math.random() * langQuotes.length);
    } while (usedSet.has(idx));
    usedSet.add(idx);
    const seed = langQuotes[idx];
    quotes.push(makeQuote(seed.text, seed.author, seed.category));
  }
  return quotes;
}

async function cacheQuotes(quotes: Quote[]): Promise<void> {
  try {
    const existing = await getCachedQuotes();
    const merged = [...existing, ...quotes].slice(-50);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(merged));
  } catch {
    /* silent */
  }
}

export async function getCachedQuotes(): Promise<Quote[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* silent */
  }
  return [];
}

export async function clearQuoteCache(): Promise<void> {
  usedSeedIndices.clear();
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    /* silent */
  }
}

export async function getInitialQuotes(): Promise<Quote[]> {
  const cached = await getCachedQuotes();
  if (cached.length >= BATCH_SIZE) {
    return cached.slice(-BATCH_SIZE);
  }
  try {
    return await fetchQuoteBatch();
  } catch {
    return getOfflineQuotes(BATCH_SIZE);
  }
}
