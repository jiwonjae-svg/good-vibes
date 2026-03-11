import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { useUserStore } from '../stores/useUserStore';
import { Fonts, FontSize, Spacing, BorderRadius, Shadows } from '../constants/theme';
import type { Quote } from '../stores/useQuoteStore';

interface Props {
  quotes: Quote[];
  onPress?: (quote: Quote) => void;
}

/**
 * Deterministically selects today's featured quote based on a hash of the date.
 * Returns the same quote for the whole day regardless of feed composition.
 */
function getDailyQuote(quotes: Quote[]): Quote | null {
  if (quotes.length === 0) return null;
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  // Simple hash → stable index
  let hash = seed;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = (hash >> 16) ^ hash;
  const idx = Math.abs(hash) % quotes.length;
  return quotes[idx];
}

export default function DailyQuoteCard({ quotes, onPress }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const isDark = useUserStore((s) => s.isDarkMode);
  const quote = useMemo(() => getDailyQuote(quotes), [quotes]);

  if (!quote) return null;

  const gradient = isDark
    ? (['#1a1a3a', '#2d1b69'] as [string, string])
    : (['#FFE5D9', '#E8D4FF'] as [string, string]);

  return (
    <Pressable onPress={() => onPress?.(quote)} style={styles.wrapper}>
      <LinearGradient colors={gradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.labelRow}>
          <Ionicons name="sunny-outline" size={14} color={isDark ? '#FFD166' : '#FF9F7E'} />
          <Text style={[styles.label, { color: isDark ? '#FFD166' : '#FF9F7E' }]}>
            {t('home.dailyQuote')}
          </Text>
        </View>
        <Text style={[styles.quoteText, { color: colors.textPrimary }]} numberOfLines={4}>
          {quote.text}
        </Text>
        {quote.author ? (
          <Text style={[styles.author, { color: colors.textSecondary }]}>— {quote.author}</Text>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.card,
  },
  gradient: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  quoteText: {
    ...Fonts.quote,
    fontSize: FontSize.md,
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  author: {
    ...Fonts.body,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    textAlign: 'right',
    marginTop: 4,
  },
});
