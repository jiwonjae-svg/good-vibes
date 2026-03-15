import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

const WIDGET_DATA_KEY = '@dailyglow_widget_data';

export interface WidgetQuoteData {
  id?: string;
  text: string;
  author?: string;
  category?: string;
  streak?: number;
  updatedAt: number;
}

export const widgetService = {
  async updateWidgetQuote(quote: WidgetQuoteData): Promise<void> {
    try {
      await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(quote));

      const streak = quote.streak ?? 0;
      if (Platform.OS === 'android' && NativeModules.WidgetModule) {
        await NativeModules.WidgetModule.saveQuoteData(quote.text, quote.author ?? '', quote.id ?? '');
        if (streak > 0) await NativeModules.WidgetModule.saveStreakData(streak);
        await NativeModules.WidgetModule.updateWidget();
      } else if (Platform.OS === 'ios' && NativeModules.WidgetModule) {
        await NativeModules.WidgetModule.saveQuoteData(quote.text, quote.author ?? '', quote.id ?? '');
        if (streak > 0) await NativeModules.WidgetModule.saveStreakData(streak);
        await NativeModules.WidgetModule.reloadAllTimelines();
      }
    } catch (error) {
      console.error('[widgetService] Failed to update widget:', error);
    }
  },

  async getWidgetQuote(): Promise<WidgetQuoteData | null> {
    try {
      const data = await AsyncStorage.getItem(WIDGET_DATA_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async clearWidgetQuote(): Promise<void> {
    try {
      await AsyncStorage.removeItem(WIDGET_DATA_KEY);
    } catch {
      // silent fail
    }
  },
};

export async function saveQuoteForWidget(
  text: string,
  author?: string,
  category?: string,
  id?: string,
  streak?: number,
): Promise<void> {
  const entry: WidgetQuoteData = { id, text, author, category, streak, updatedAt: Date.now() };
  await widgetService.updateWidgetQuote(entry);

  // Maintain the rolling buffer for widget refresh cycling
  try {
    const buffer = await getQuotesBuffer();
    const updated = [entry, ...buffer.filter((q) => q.id !== id)].slice(0, MAX_BUFFER);
    await saveQuotesBufferForWidget(updated);
  } catch {
    // silent — buffer update is non-critical
  }
}

export async function saveStreakForWidget(streak: number): Promise<void> {
  try {
    if (Platform.OS === 'android' && NativeModules.WidgetModule) {
      await NativeModules.WidgetModule.saveStreakData(streak);
      await NativeModules.WidgetModule.updateWidget();
    } else if (Platform.OS === 'ios' && NativeModules.WidgetModule) {
      await NativeModules.WidgetModule.saveStreakData(streak);
      await NativeModules.WidgetModule.reloadAllTimelines();
    }
  } catch (error) {
    console.error('[widgetService] Failed to save streak:', error);
  }
}

const WIDGET_QUOTES_BUFFER_KEY = '@dailyglow_widget_quotes_buffer';
const MAX_BUFFER = 5;

async function getQuotesBuffer(): Promise<WidgetQuoteData[]> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_QUOTES_BUFFER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Saves up to 5 recent quotes so the widget refresh button can cycle through them. */
export async function saveQuotesBufferForWidget(quotes: WidgetQuoteData[]): Promise<void> {
  try {
    const trimmed = quotes.slice(0, MAX_BUFFER);
    await AsyncStorage.setItem(WIDGET_QUOTES_BUFFER_KEY, JSON.stringify(trimmed));
    const nativePayload = trimmed.map((q) => ({ text: q.text, author: q.author ?? '', id: q.id ?? '' }));
    if (Platform.OS === 'android' && NativeModules.WidgetModule?.saveQuotesData) {
      await NativeModules.WidgetModule.saveQuotesData(JSON.stringify(nativePayload));
    }
  } catch (error) {
    console.error('[widgetService] Failed to save quotes buffer:', error);
  }
}

/** Syncs the font size multiplier to the widget on both platforms. */
export async function saveFontSizeForWidget(multiplier: number): Promise<void> {
  try {
    if (Platform.OS === 'android' && NativeModules.WidgetModule?.saveFontSizeData) {
      await NativeModules.WidgetModule.saveFontSizeData(multiplier);
      await NativeModules.WidgetModule.updateWidget();
    } else if (Platform.OS === 'ios' && NativeModules.WidgetModule?.saveFontSizeData) {
      await NativeModules.WidgetModule.saveFontSizeData(multiplier);
      await NativeModules.WidgetModule.reloadAllTimelines();
    }
  } catch (error) {
    console.error('[widgetService] Failed to save font size for widget:', error);
  }
}
