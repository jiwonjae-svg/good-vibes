import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      }
      router.replace('/(tabs)');
    };
    navigate();
  }, []);

  return <View />;
}
