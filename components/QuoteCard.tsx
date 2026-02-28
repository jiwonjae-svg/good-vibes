import React from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontSize, Spacing, BorderRadius, Shadows, Fonts } from '../constants/theme';
import { useThemeColors } from '../hooks/useThemeColors';
import type { Quote } from '../stores/useQuoteStore';
import { useUserStore } from '../stores/useUserStore';
import { Ionicons } from '@expo/vector-icons';
import { useTTS } from '../hooks/useTTS';
import { useTranslation } from 'react-i18next';
import { shareQuoteText } from '../services/shareService';

const ACTION_BG_LIGHT = 'rgba(255,255,255,0.88)';
const ACTION_BG_DARK = 'rgba(30,30,30,0.82)';

interface QuoteCardProps {
  quote: Quote;
  onSpeakAlong: () => void;
  onWriteAlong: () => void;
  onTypeAlong: () => void;
}

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
export const CARD_HEIGHT = SCREEN_HEIGHT;

const HIDDEN_AUTHORS = ['작자 미상', 'Unknown', '不明', '佚名'];

export default function QuoteCard({ quote, onSpeakAlong, onWriteAlong, onTypeAlong }: QuoteCardProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { speak, stop, isSpeaking } = useTTS();
  const toggleBookmark = useUserStore((s) => s.toggleBookmark);
  const isBookmarked = useUserStore((s) => s.isBookmarked);
  const bookmarked = isBookmarked(quote.id);
  const isDark = useUserStore((s) => s.isDarkMode);
  const gradient = colors.cardGradients[quote.gradientIndex % colors.cardGradients.length];
  const showAuthor = quote.author && !HIDDEN_AUTHORS.includes(quote.author);
  const actionBg = isDark ? ACTION_BG_DARK : ACTION_BG_LIGHT;

  const handleTTS = () => (isSpeaking ? stop() : speak(quote.text));

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradient} style={styles.gradient}>
        <View style={styles.content}>
          <View style={styles.topActions}>
            <Pressable onPress={handleTTS} style={styles.iconBtn}>
              <Ionicons name={isSpeaking ? 'volume-high' : 'volume-medium-outline'} size={24} color={colors.textSecondary} />
            </Pressable>
            <Pressable onPress={() => toggleBookmark(quote.id)} style={styles.iconBtn}>
              <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={24} color={bookmarked ? colors.primary : colors.textSecondary} />
            </Pressable>
            <Pressable onPress={() => shareQuoteText(quote.text, quote.author)} style={styles.iconBtn}>
              <Ionicons name="share-outline" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.quoteWrapper}>
            <Text style={[styles.quoteMark, { color: colors.primary }]}>{'\u201C'}</Text>
            <Text style={[styles.quoteText, { color: colors.textPrimary }]}>{quote.text}</Text>
            <Text style={[styles.quoteMarkEnd, { color: colors.primary }]}>{'\u201D'}</Text>
          </View>

          {quote.category && (
            <View style={[styles.categoryBadge, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
                {quote.category}
              </Text>
            </View>
          )}

          {showAuthor && (
            <Text style={[styles.author, { color: colors.textSecondary }]}>— {quote.author}</Text>
          )}
        </View>

        <View style={styles.floatingActions}>
          <Pressable style={[styles.actionButton, { backgroundColor: actionBg }]} onPress={onSpeakAlong}>
            <Ionicons name="mic-outline" size={22} color={colors.textPrimary} />
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>{t('home.speakAlong')}</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, { backgroundColor: actionBg }]} onPress={onWriteAlong}>
            <Ionicons name="pencil-outline" size={22} color={colors.textPrimary} />
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>{t('home.writeAlong')}</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, { backgroundColor: actionBg }]} onPress={onTypeAlong}>
            <Ionicons name="keypad-outline" size={22} color={colors.textPrimary} />
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>{t('home.typeAlong')}</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: CARD_HEIGHT, width: SCREEN_WIDTH },
  gradient: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.lg },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 120 },
  topActions: { position: 'absolute', top: 56, right: 0, flexDirection: 'row', gap: Spacing.xs },
  iconBtn: { padding: Spacing.sm },
  quoteWrapper: { alignItems: 'center', paddingHorizontal: Spacing.md },
  quoteMark: { ...Fonts.quote, fontSize: 60, opacity: 0.4, lineHeight: 70, marginBottom: -20 },
  quoteText: { ...Fonts.quote, fontSize: FontSize.xxl, textAlign: 'center', lineHeight: 48, letterSpacing: 0.5 },
  quoteMarkEnd: { ...Fonts.quote, fontSize: 60, opacity: 0.4, lineHeight: 70, marginTop: -10 },
  categoryBadge: { marginTop: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  categoryText: { ...Fonts.body, fontSize: FontSize.sm },
  author: { ...Fonts.body, fontSize: FontSize.md, marginTop: Spacing.sm },
  floatingActions: { position: 'absolute', bottom: 100, flexDirection: 'row', gap: Spacing.md },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderRadius: BorderRadius.full, ...Shadows.floating },
  actionLabel: { ...Fonts.body, fontSize: FontSize.sm },
});
