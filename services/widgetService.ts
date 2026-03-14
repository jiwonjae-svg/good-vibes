import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

const WIDGET_DATA_KEY = '@dailyglow_widget_data';

export interface WidgetQuoteData {
  text: string;
  author?: string;
  category?: string;
  updatedAt: number;
}

export const widgetService = {
  async updateWidgetQuote(quote: WidgetQuoteData): Promise<void> {
    try {
      await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(quote));

      if (Platform.OS === 'android' && NativeModules.WidgetModule) {
        await NativeModules.WidgetModule.saveQuoteData(quote.text, quote.author ?? '');
        await NativeModules.WidgetModule.updateWidget();
      } else if (Platform.OS === 'ios' && NativeModules.WidgetModule) {
        await NativeModules.WidgetModule.saveQuoteData(quote.text, quote.author ?? '');
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
  category?: string
): Promise<void> {
  await widgetService.updateWidgetQuote({
    text,
    author,
    category,
    updatedAt: Date.now(),
  });
}
