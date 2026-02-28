import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GrassDay {
  date: string; // YYYY-MM-DD
  speakCount: number;
  writeCount: number;
  typeCount: number;
}

type ActivityType = 'speak' | 'write' | 'type';

interface GrassState {
  grassData: Record<string, GrassDay>;
  isLoaded: boolean;

  loadGrassData: () => Promise<void>;
  recordActivity: (type: ActivityType) => Promise<void>;
  getGrassDay: (date: string) => GrassDay;
  getTotalForDay: (date: string) => number;
  getLevel: (date: string) => number;
}

const STORAGE_KEY = '@dailyglow_grass';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function emptyDay(date: string): GrassDay {
  return { date, speakCount: 0, writeCount: 0, typeCount: 0 };
}

export const useGrassStore = create<GrassState>((set, get) => ({
  grassData: {},
  isLoaded: false,

  loadGrassData: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        set({ grassData: JSON.parse(raw), isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  recordActivity: async (type) => {
    const date = todayKey();
    const current = get().grassData[date] ?? emptyDay(date);

    const updated: GrassDay = {
      ...current,
      speakCount: current.speakCount + (type === 'speak' ? 1 : 0),
      writeCount: current.writeCount + (type === 'write' ? 1 : 0),
      typeCount: current.typeCount + (type === 'type' ? 1 : 0),
    };

    const newData = { ...get().grassData, [date]: updated };
    set({ grassData: newData });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch {
      // silent fail for storage
    }
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
}));
