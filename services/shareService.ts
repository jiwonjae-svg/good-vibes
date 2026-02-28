import { Share, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

export async function shareQuoteText(text: string, author: string): Promise<void> {
  const authorLine = author && author !== '작자 미상' ? `\n— ${author}` : '';
  const message = `"${text}"${authorLine}\n\n#goodvibes #명언`;

  try {
    await Share.share({
      message,
      title: 'Good Vibes',
    });
  } catch { /* user cancelled */ }
}

export async function shareQuoteImage(uri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) return;

  try {
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Good Vibes',
    });
  } catch { /* silent */ }
}
