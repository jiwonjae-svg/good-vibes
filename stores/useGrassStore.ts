import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveGrassDay, fetchGrassData } from '../services/firestoreUserService';

export interface ActivityQuote {
  id: string;
  text: string;
  timestamp: number;
}

export interface GrassDay {
  date: string; // YYYY-MM-DD
  speakCount: number;
  writeCount: number;
  typeCount: number;
  speakQuotes: ActivityQuote[];
  writeQuotes: ActivityQuote[];
  typeQuotes: ActivityQuote[];
}

type ActivityType = 'speak' | 'write' | 'type';

interface GrassState {
  grassData: Record<string, GrassDay>;
  isLoaded: boolean;

  loadGrassData: () => Promise<void>;
  recordActivity: (type: ActivityType, quoteId?: string, quoteText?: string) => Promise<void>;
  getGrassDay: (date: string) => GrassDay;
  getTotalForDay: (date: string) => number;
  getLevel: (date: string) => number;
  getActivityQuotes: (date: string, type: ActivityType) => ActivityQuote[];
}

const STORAGE_KEY = '@dailyglow_grass';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function emptyDay(date: string): GrassDay {
  return {
    date,
    speakCount: 0,
    writeCount: 0,
    typeCount: 0,
    speakQuotes: [],
    writeQuotes: [],
    typeQuotes: [],
  };
}

export const useGrassStore = create<GrassState>((set, get) => ({
  grassData: {},
  isLoaded: false,

  loadGrassData: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      let localData: Record<string, GrassDay> = {};
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const key of Object.keys(parsed)) {
          const day = parsed[key];
          localData[key] = {
            ...emptyDay(day.date),
            ...day,
            speakQuotes: day.speakQuotes || [],
            writeQuotes: day.writeQuotes || [],
            typeQuotes: day.typeQuotes || [],
          };
        }
      }
      set({ grassData: localData, isLoaded: true });

      // Merge with Firestore data (cloud wins on conflict)
      try {
        const { useUserStore } = require('./useUserStore');
        const uid: string | null = useUserStore.getState().uid;
        if (uid) {
          const cloudData = await fetchGrassData(uid);
          if (Object.keys(cloudData).length > 0) {
            const merged = { ...localData, ...cloudData };
            set({ grassData: merged });
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged)).catch(() => {});
          }
        }
      } catch { /* silent */ }
    } catch {
      set({ isLoaded: true });
    }
  },

  recordActivity: async (type, quoteId, quoteText) => {
    const date = todayKey();
    const current = get().grassData[date] ?? emptyDay(date);

    const newQuote: ActivityQuote | null =
      quoteId && quoteText
        ? { id: quoteId, text: quoteText, timestamp: Date.now() }
        : null;

    const updated: GrassDay = {
      ...current,
      speakCount: current.speakCount + (type === 'speak' ? 1 : 0),
      writeCount: current.writeCount + (type === 'write' ? 1 : 0),
      typeCount: current.typeCount + (type === 'type' ? 1 : 0),
      speakQuotes:
        type === 'speak' && newQuote
          ? [...current.speakQuotes, newQuote]
          : current.speakQuotes,
      writeQuotes:
        type === 'write' && newQuote
          ? [...current.writeQuotes, newQuote]
          : current.writeQuotes,
      typeQuotes:
        type === 'type' && newQuote
          ? [...current.typeQuotes, newQuote]
          : current.typeQuotes,
    };

    const newData = { ...get().grassData, [date]: updated };
    set({ grassData: newData });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch {
      // silent fail
    }

    // Sync to Firestore (fire-and-forget)
    try {
      const { useUserStore } = require('./useUserStore');
      const uid: string | null = useUserStore.getState().uid;
      if (uid) saveGrassDay(uid, date, updated).catch(() => {});
    } catch { /* silent */ }
  },

  getGrassDay: (date) => get().grassData[date] ?? emptyDay(date),

  getTotalForDay: (date) => {
    const day = get().grassData[date];
    if (!day) return 0;
    return day.speakCount + day.writeCount + day.typeCount;
  },

  getLevel: (date) => {
    const total = get().getTotalForDay(date);
    if (total === 0) return 0;
    if (total <= 1) return 1;
    if (total <= 3) return 2;
    if (total <= 6) return 3;
    return 4;
  },

  getActivityQuotes: (date, type) => {
    const day = get().grassData[date] ?? emptyDay(date);
    switch (type) {
      case 'speak':
        return day.speakQuotes;
      case 'write':
        return day.writeQuotes;
      case 'type':
        return day.typeQuotes;
      default:
        return [];
    }
  },
}));
