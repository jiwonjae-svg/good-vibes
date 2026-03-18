import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuoteStore } from '../stores/useQuoteStore';

const PENDING_QUOTE_KEY = '@dailyglow_pending_quote_id';

/**
 * Handles the widget deep link: com.jiwonjae.dailyglow://quote?id=<quoteId>
 *
 * Expo Router routes this path to here instead of showing "Unmatched Route".
 * We store the quote ID so the home screen can scroll to it, then redirect
 * to the main tabs immediately.
 */
export default function QuoteDeepLink() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  useEffect(() => {
    const navigate = async () => {
      if (id) {
        await AsyncStorage.setItem(PENDING_QUOTE_KEY, id).catch(() => {});
        // Also set the store so the home screen reacts even on warm starts
        useQuoteStore.getState().setPendingDeepLinkQuoteId(id);
      }
      // On warm starts the existing (tabs) screen is already below in the stack;
      // using replace would create a SECOND tabs instance. Use back() so we
      // return to the existing instance (which will pick up the deep-link via
      // the Zustand pendingDeepLinkQuoteId effect).  On cold starts there is
      // nothing to go back to, so replace is correct.
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    };
    navigate();
  }, []);

  return <View />;
}
