import { Share, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { appLog } from './logger';
import { useUserStore } from '../stores/useUserStore';

/** Display strings for "unknown author" across all supported locales. */
const UNKNOWN_AUTHOR = ['작자 미상', 'Unknown', 'Unknown Author', '不明', '不明な著者', '佚名'] as const;

export async function shareQuoteText(text: string, author: string): Promise<void> {
  const authorLine = author && !UNKNOWN_AUTHOR.some((u) => author === u) ? `\n— ${author}` : '';
  const message = `"${text}"${authorLine}\n\n#dailyglow #명언`;

  try {
    const result = await Share.share({
      message,
      title: 'DailyGlow',
    });
    if (result.action === Share.sharedAction) {
      useUserStore.getState().incrementShareCount().catch(() => {});
    }
  } catch { /* user cancelled */ }
}

export async function shareQuoteImage(uri: string): Promise<boolean> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    appLog.warn('[share] image sharing unavailable on this device');
    return false;
  }

  try {
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'DailyGlow',
    });
    return true;
  } catch { /* user cancelled */ }
  return false;
}
