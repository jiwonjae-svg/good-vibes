import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateQuotes } from './grokApi';
import { seedQuotes } from '../data/seedQuotes';
import { LightColors } from '../constants/theme';
import { QUOTE_CONFIG } from '../constants/config';
import { useUserStore, type QuoteCategory } from '../stores/useUserStore';
import type { Quote } from '../stores/useQuoteStore';

const CACHE_KEY = '@good_vibe_quotes_cache';
let usedSeedIndices = new Set<number>();

function makeQuote(text: string, author: string): Quote {
  return {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    author,
    createdAt: Date.now(),
    gradientIndex: Math.floor(Math.random() * LightColors.cardGradients.length),
  };
}

function getCategory(): QuoteCategory {
  return useUserStore.getState().category ?? 'all';
}

export async function fetchQuoteBatch(): Promise<Quote[]> {
  try {
    const rawQuotes = await generateQuotes(QUOTE_CONFIG.batchSize, getCategory());
    const quotes = rawQuotes.map((q) => makeQuote(q.text, q.author));
    await cacheQuotes(quotes);
    return quotes;
  } catch {
    return getOfflineQuotes(QUOTE_CONFIG.batchSize);
  }
}

function getOfflineQuotes(count: number): Quote[] {
  const available = seedQuotes.length;
  const quotes: Quote[] = [];
  for (let i = 0; i < count; i++) {
    if (usedSeedIndices.size >= available) usedSeedIndices.clear();
    let idx: number;
    do { idx = Math.floor(Math.random() * available); } while (usedSeedIndices.has(idx));
    usedSeedIndices.add(idx);
    quotes.push(makeQuote(seedQuotes[idx].text, seedQuotes[idx].author));
  }
  return quotes;
}

async function cacheQuotes(quotes: Quote[]): Promise<void> {
  try {
    const existing = await getCachedQuotes();
    const merged = [...existing, ...quotes].slice(-100);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(merged));
  } catch { /* silent */ }
}

export async function getCachedQuotes(): Promise<Quote[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* silent */ }
  return [];
}

export async function clearQuoteCache(): Promise<void> {
  usedSeedIndices.clear();
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch { /* silent */ }
}

export async function getInitialQuotes(): Promise<Quote[]> {
  const cached = await getCachedQuotes();
  if (cached.length >= QUOTE_CONFIG.batchSize) {
    return cached.slice(-QUOTE_CONFIG.batchSize);
  }
  try { return await fetchQuoteBatch(); }
  catch { return getOfflineQuotes(QUOTE_CONFIG.batchSize); }
}
