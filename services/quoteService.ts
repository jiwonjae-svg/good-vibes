import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors } from '../constants/theme';
import { clientQuotes } from '../data/quotes';
import type { Quote } from '../stores/useQuoteStore';

const CACHE_KEY = '@dailyglow_quotes_cache';
const BATCH_SIZE = 5;
let usedIndices = new Set<number>();

function makeQuote(text: string, author: string, source?: string): Quote {
  return {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    author,
    category: source,
    createdAt: Date.now(),
    gradientIndex: Math.floor(Math.random() * LightColors.cardGradients.length),
  };
}

function getOfflineQuotes(count: number): Quote[] {
  const quotes: Quote[] = [];
  for (let i = 0; i < count; i++) {
    if (usedIndices.size >= clientQuotes.length) usedIndices.clear();
    let idx: number;
    do {
      idx = Math.floor(Math.random() * clientQuotes.length);
    } while (usedIndices.has(idx));
    usedIndices.add(idx);
    const item = clientQuotes[idx];
    quotes.push(makeQuote(item.quote, item.author, item.source));
  }
  return quotes;
}

export async function fetchQuoteBatch(): Promise<Quote[]> {
  const quotes = getOfflineQuotes(BATCH_SIZE);
  await cacheQuotes(quotes);
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
  usedIndices.clear();
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
  return getOfflineQuotes(BATCH_SIZE);
}
