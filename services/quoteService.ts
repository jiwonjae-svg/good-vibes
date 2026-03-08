import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors } from '../constants/theme';
import { clientQuotes } from '../data/quotes';
import type { CrawledQuote } from '../data/quotes';
import { useUserStore } from '../stores/useUserStore';
import type { Quote } from '../stores/useQuoteStore';
import { fetchServerQuotesFromFirestore } from './firebaseConfig';
import i18n from '../i18n';

const CACHE_KEY = '@dailyglow_quotes_cache';
const RECENT_IDS_KEY = '@dailyglow_recent_quote_ids';
const SERVER_QUOTES_CACHE_KEY = '@dailyglow_server_quotes_cache';
const SERVER_QUOTES_UPDATED_KEY = '@dailyglow_server_quotes_updated';
/** Cache TTL for server quotes: 7 days */
const SERVER_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 5;
const CANDIDATE_COUNT = 10;
const RECENT_EXCLUDE = 20;

/**
 * Returns the server quote pool.
 * - Online: loads from Firestore and caches in AsyncStorage (TTL: 7 days)
 * - Offline / failure: returns stale cache, or empty array if none exists
 */
async function getServerQuotes(): Promise<CrawledQuote[]> {
  try {
    const updatedRaw = await AsyncStorage.getItem(SERVER_QUOTES_UPDATED_KEY);
    const updatedAt = updatedRaw ? parseInt(updatedRaw, 10) : 0;
    const cacheIsValid = Date.now() - updatedAt < SERVER_CACHE_TTL;

    if (cacheIsValid) {
      const cachedRaw = await AsyncStorage.getItem(SERVER_QUOTES_CACHE_KEY);
      if (cachedRaw) {
        const parsed: CrawledQuote[] = JSON.parse(cachedRaw);
        if (parsed.length > 0) return parsed;
      }
    }

    // Attempt to load from Firestore
    const fresh = await fetchServerQuotesFromFirestore();
    if (fresh.length > 0) {
      await AsyncStorage.setItem(SERVER_QUOTES_CACHE_KEY, JSON.stringify(fresh));
      await AsyncStorage.setItem(SERVER_QUOTES_UPDATED_KEY, String(Date.now()));
      return fresh;
    }

    // Offline or empty response — fall back to stale cache if available
    const staleCached = await AsyncStorage.getItem(SERVER_QUOTES_CACHE_KEY);
    if (staleCached) return JSON.parse(staleCached) as CrawledQuote[];
  } catch {
    /* silent */
  }
  return [];
}

function makeQuote(
  item: { id: string; quote: string; author: string; source: string },
  lang: string,
): Quote {
  const text = (item as { translations?: Record<string, string> }).translations?.[lang]
    ?? (item as { quote: string }).quote;
  return {
    id: item.id,
    text,
    author: item.author,
    source: item.source,
    category: item.source,
    createdAt: Date.now(),
    gradientIndex: Math.floor(Math.random() * LightColors.cardGradients.length),
  };
}

async function getRecentIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveRecentIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RECENT_IDS_KEY, JSON.stringify(ids));
  } catch {
    /* silent */
  }
}

/** O(n) Fisher-Yates shuffle — avoids the bias and O(n log n) cost of sort-based shuffles. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function scoreQuote(categories: Record<string, number>, selectedCats: string[]): number {
  if (selectedCats.length === 0) return 0;
  return selectedCats.reduce((sum, cat) => sum + (categories[cat] ?? 0), 0);
}

function pickOneByWeight(
  candidates: typeof clientQuotes,
  selectedCats: string[],
): typeof clientQuotes[0] {
  // Single pass — no intermediate array allocations.
  let maxScore = -Infinity;
  let maxIndices: number[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const s = scoreQuote(candidates[i].categories, selectedCats);
    if (s > maxScore) { maxScore = s; maxIndices = [i]; }
    else if (s === maxScore) { maxIndices.push(i); }
  }
  const idx = maxIndices[Math.floor(Math.random() * maxIndices.length)];
  return candidates[idx];
}

async function selectQuotes(count: number): Promise<Quote[]> {
  const lang = i18n.language;
  const selectedCats = useUserStore.getState().selectedCategories ?? [];

  // Load server quotes (Firestore when online, cache or empty array when offline)
  const serverQuotes = await getServerQuotes();
  const allQuotes: CrawledQuote[] = [...clientQuotes, ...serverQuotes];

  let recentIds = await getRecentIds();
  const recentSet = new Set(recentIds);
  let pool = allQuotes.filter((q) => !recentSet.has(q.id));
  if (pool.length < CANDIDATE_COUNT) {
    recentIds = [];
    pool = allQuotes;
  }
  const available = pool;

  const result: Quote[] = [];
  const usedRecent: string[] = [...recentIds];
  // Shuffle once — O(n) Fisher-Yates — reused across all picks in this batch.
  const shuffled = shuffle(available);

  for (let i = 0; i < count; i++) {
    const excludeSet = new Set(usedRecent);
    let candidates = shuffled.filter((q) => !excludeSet.has(q.id)).slice(0, CANDIDATE_COUNT);
    // If all remaining quotes are in the recent list, fall back to the full shuffled pool.
    if (candidates.length === 0) {
      candidates = shuffled.slice(0, Math.min(CANDIDATE_COUNT, shuffled.length));
    }

    const chosen = pickOneByWeight(candidates, selectedCats);
    result.push(makeQuote(chosen, lang));

    usedRecent.push(chosen.id);
    if (usedRecent.length > RECENT_EXCLUDE) {
      usedRecent.shift();
    }
  }

  await saveRecentIds(usedRecent);
  return result;
}

export async function fetchQuoteBatch(): Promise<Quote[]> {
  const quotes = await selectQuotes(BATCH_SIZE);
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
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
    await AsyncStorage.removeItem(RECENT_IDS_KEY);
  } catch {
    /* silent */
  }
}

/** Clears the server quotes cache, forcing a fresh Firestore load on next call. */
export async function clearServerQuotesCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SERVER_QUOTES_CACHE_KEY);
    await AsyncStorage.removeItem(SERVER_QUOTES_UPDATED_KEY);
  } catch {
    /* silent */
  }
}

export async function getInitialQuotes(): Promise<Quote[]> {
  const cached = await getCachedQuotes();
  if (cached.length >= BATCH_SIZE) {
    return cached.slice(-BATCH_SIZE);
  }
  return selectQuotes(BATCH_SIZE);
}
