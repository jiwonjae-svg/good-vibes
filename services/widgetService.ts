import AsyncStorage from '@react-native-async-storage/async-storage';

const WIDGET_QUOTE_KEY = '@dailyglow_widget_quote';

export interface WidgetQuoteData {
  text: string;
  author: string;
  updatedAt: number;
}

/**
 * Save the current quote for the home screen widget.
 * The widget reads from shared storage (App Group on iOS, SharedPreferences on Android).
 * This uses AsyncStorage as a bridge — the native widget code reads from the same store.
 */
export async function saveQuoteForWidget(
  text: string,
  author: string
): Promise<void> {
  const data: WidgetQuoteData = {
    text,
    author,
    updatedAt: Date.now(),
  };

  try {
    await AsyncStorage.setItem(WIDGET_QUOTE_KEY, JSON.stringify(data));
  } catch {
    // silent
  }
}

export async function getWidgetQuote(): Promise<WidgetQuoteData | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_QUOTE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // silent
  }
  return null;
}
