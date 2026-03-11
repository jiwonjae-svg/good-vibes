import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { useUserStore } from '../stores/useUserStore';
import { Fonts, FontSize, Spacing, BorderRadius, Shadows } from '../constants/theme';
import type { Quote } from '../stores/useQuoteStore';

interface Props {
  visible: boolean;
  quotes: Quote[];
  onClose: () => void;
  onViewCard: (quote: Quote) => void;
}

function getDailyQuote(quotes: Quote[]): Quote | null {
  if (quotes.length === 0) return null;
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  let hash = seed;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = (hash >> 16) ^ hash;
  return quotes[Math.abs(hash) % quotes.length];
}

export { getDailyQuote };

export default function DailyQuoteModal({ visible, quotes, onClose, onViewCard }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const isDark = useUserStore((s) => s.isDarkMode);
  const quote = useMemo(() => getDailyQuote(quotes), [quotes]);

  if (!quote) return null;

  const gradient = isDark
    ? (['#1a1a3a', '#2d1b69'] as [string, string])
    : (['#FFE5D9', '#E8D4FF'] as [string, string]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="sunny-outline" size={18} color={isDark ? '#FFD166' : '#FF9F7E'} />
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t('home.dailyQuote')}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Quote card */}
          <LinearGradient
            colors={gradient}
            style={styles.quoteCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={[styles.quoteText, { color: colors.textPrimary }]}>
              {quote.text}
            </Text>
            {quote.author ? (
              <Text style={[styles.author, { color: colors.textSecondary }]}>
                — {quote.author}
              </Text>
            ) : null}
          </LinearGradient>

          {/* CTA button */}
          <Pressable
            style={[styles.viewBtn, { backgroundColor: colors.primary }]}
            onPress={() => onViewCard(quote)}
          >
            <Ionicons name="arrow-forward-circle-outline" size={20} color="#fff" />
            <Text style={styles.viewBtnText}>{t('home.viewQuoteCard')}</Text>
          </Pressable>

          <Pressable onPress={onClose} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: colors.textMuted }]}>
              {t('common.cancel')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    ...Fonts.heading,
    fontSize: FontSize.lg,
  },
  closeBtn: {
    padding: 4,
  },
  quoteCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  quoteText: {
    ...Fonts.quote,
    fontSize: FontSize.md,
    lineHeight: 26,
    letterSpacing: 0.2,
  },
  author: {
    ...Fonts.body,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    textAlign: 'right',
    marginTop: 4,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  viewBtnText: {
    ...Fonts.heading,
    fontSize: FontSize.md,
    color: '#fff',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  skipText: {
    ...Fonts.body,
    fontSize: FontSize.sm,
  },
});
