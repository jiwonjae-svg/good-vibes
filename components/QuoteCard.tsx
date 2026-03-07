import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontSize, Spacing, BorderRadius, Shadows, Fonts } from '../constants/theme';
import { useThemeColors } from '../hooks/useThemeColors';
import type { Quote } from '../stores/useQuoteStore';
import { useUserStore } from '../stores/useUserStore';
import { useAutoPlayStore } from '../stores/useAutoPlayStore';
import { Ionicons } from '@expo/vector-icons';
import { useTTS } from '../hooks/useTTS';
import { useTranslation } from 'react-i18next';
import { shareQuoteText } from '../services/shareService';
import LoginPromptModal from './LoginPromptModal';
import PremiumPromptModal from './PremiumPromptModal';

const ACTION_BG_LIGHT = 'rgba(255,255,255,0.92)';
const ACTION_BG_DARK = 'rgba(30,30,30,0.85)';

function sourceLabel(source: string): string {
  switch (source) {
    case 'quotable': return 'Quotable';
    case 'wikiquote': return 'Wikiquote';
    case 'gutenberg': return 'Project Gutenberg';
    default: return source;
  }
}

const QUOTE_OPEN_IMG = require('../assets/double quotes-front.png');
const QUOTE_CLOSE_IMG = require('../assets/double quotes-back.png');

interface QuoteCardProps {
  quote: Quote;
  onSpeakAlong: () => void;
  onWriteAlong: () => void;
  onTypeAlong: () => void;
}

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
export const CARD_HEIGHT = SCREEN_HEIGHT;

interface QuoteCardPropsExtended extends QuoteCardProps {
  onToggleAutoPlay?: () => void;
}

export default function QuoteCard({ quote, onSpeakAlong, onWriteAlong, onTypeAlong, onToggleAutoPlay }: QuoteCardPropsExtended) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  // Position follow-along buttons above the tab bar.
  // Tab bar height = 65 + max(20, insets.bottom); add 16px gap on top.
  const tabBarHeight = 65 + Math.max(20, insets.bottom);
  const floatingActionsBottom = tabBarHeight + 16;
  const { speak, stop, isSpeaking } = useTTS();
  const toggleBookmark = useUserStore((s) => s.toggleBookmark);
  const isBookmarked = useUserStore((s) => s.isBookmarked);
  const uid = useUserStore((s) => s.uid);
  const isPremium = useUserStore((s) => s.isPremium);
  const incrementGuestTrial = useUserStore((s) => s.incrementGuestTrial);
  const bookmarked = isBookmarked(quote.id);
  const isDark = useUserStore((s) => s.isDarkMode);
  const isAutoPlaying = useAutoPlayStore((s) => s.isAutoPlaying);
  const gradient = colors.cardGradients[quote.gradientIndex % colors.cardGradients.length];
  const actionBg = isDark ? ACTION_BG_DARK : ACTION_BG_LIGHT;
  const isGuest = !uid;
  
  const [loginPromptVisible, setLoginPromptVisible] = useState(false);
  const [premiumPromptVisible, setPremiumPromptVisible] = useState(false);

  const quoteMarkColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(50,50,50,0.4)';
  const quoteTextColor = isDark ? '#ffffff' : '#2d2d2d';

  const handleTTS = () => (isSpeaking ? stop() : speak(quote.text));
  
  const handleBookmark = () => {
    if (isGuest) {
      setLoginPromptVisible(true);
      return;
    }
    toggleBookmark(quote.id);
  };
  
  const handleAutoPlay = () => {
    if (isGuest) {
      setLoginPromptVisible(true);
      return;
    }
    if (!isPremium) {
      setPremiumPromptVisible(true);
      return;
    }
    onToggleAutoPlay?.();
  };
  
  const handleShare = () => {
    if (isGuest) {
      setLoginPromptVisible(true);
      return;
    }
    shareQuoteText(quote.text, quote.author);
  };
  
  const handleActivity = (action: () => void) => {
    if (isGuest) {
      const count = incrementGuestTrial();
      if (count > 3) {
        setLoginPromptVisible(true);
        return;
      }
    }
    action();
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradient} style={styles.gradient}>
        <View style={styles.cardFrame}>
          <View style={styles.quoteContent}>
            <Image
              source={QUOTE_OPEN_IMG}
              style={[styles.quoteMarkOpen, { tintColor: quoteMarkColor }]}
              resizeMode="contain"
            />
            
            <Text style={[styles.quoteText, { color: quoteTextColor }]}>{quote.text}</Text>
            
            <Image
              source={QUOTE_CLOSE_IMG}
              style={[styles.quoteMarkClose, { tintColor: quoteMarkColor }]}
              resizeMode="contain"
            />

            {/* Author displayed below the closing quote mark */}
            {quote.author ? (
              <Text style={[styles.authorText, { color: quoteTextColor }]}>
                — {quote.author}
              </Text>
            ) : null}
          </View>

          {/* Source shown as a tiny label in the bottom-left corner of the card */}
          {quote.source ? (
            <Text style={[styles.sourceText, { color: quoteTextColor }]}>
              {sourceLabel(quote.source)}
            </Text>
          ) : null}
          
          <View style={styles.topActions}>
            <Pressable onPress={handleTTS} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
              <Ionicons name={isSpeaking ? 'volume-high' : 'volume-medium-outline'} size={20} color={colors.textPrimary} />
            </Pressable>
            <Pressable onPress={handleBookmark} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
              <Ionicons name={bookmarked ? 'heart' : 'heart-outline'} size={20} color={bookmarked ? '#FF6B6B' : colors.textPrimary} />
            </Pressable>
            <Pressable onPress={handleAutoPlay} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
              <Ionicons 
                name={isAutoPlaying ? 'pause-circle' : 'play-circle-outline'} 
                size={20} 
                color={isAutoPlaying ? colors.primary : colors.textPrimary} 
              />
            </Pressable>
            <Pressable onPress={handleShare} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
              <Ionicons name="share-social-outline" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.floatingActions, { bottom: floatingActionsBottom }]}>
          <Pressable style={[styles.actionButton, { backgroundColor: actionBg }]} onPress={() => handleActivity(onSpeakAlong)}>
            <Ionicons name="mic-outline" size={22} color={colors.textPrimary} />
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>{t('home.speakAlong')}</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, { backgroundColor: actionBg }]} onPress={() => handleActivity(onWriteAlong)}>
            <Ionicons name="pencil-outline" size={22} color={colors.textPrimary} />
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>{t('home.writeAlong')}</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, { backgroundColor: actionBg }]} onPress={() => handleActivity(onTypeAlong)}>
            <Ionicons name="keypad-outline" size={22} color={colors.textPrimary} />
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>{t('home.typeAlong')}</Text>
          </Pressable>
        </View>

        <LoginPromptModal
          visible={loginPromptVisible}
          onClose={() => setLoginPromptVisible(false)}
        />
        <PremiumPromptModal
          visible={premiumPromptVisible}
          onClose={() => setPremiumPromptVisible(false)}
          featureName={t('home.autoPlay')}
        />
      </LinearGradient>
    </View>
  );
}

const QUOTE_MARK_SIZE = FontSize.xl * 2;

const styles = StyleSheet.create({
  container: { height: CARD_HEIGHT, width: SCREEN_WIDTH },
  gradient: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.lg },
  cardFrame: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    position: 'relative',
  },
  quoteContent: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  quoteMarkOpen: {
    width: QUOTE_MARK_SIZE,
    height: QUOTE_MARK_SIZE,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  quoteText: {
    ...Fonts.quote,
    fontSize: FontSize.xl,
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: 0.3,
    paddingHorizontal: Spacing.sm,
  },
  quoteMarkClose: {
    width: QUOTE_MARK_SIZE,
    height: QUOTE_MARK_SIZE,
    alignSelf: 'flex-end',
    marginTop: Spacing.sm,
  },
  authorText: {
    ...Fonts.body,
    fontSize: FontSize.sm,
    alignSelf: 'flex-end',
    marginTop: Spacing.sm,
    opacity: 0.75,
    fontStyle: 'italic',
  },
  sourceText: {
    position: 'absolute',
    bottom: 6,
    left: Spacing.sm,
    fontSize: 9,
    opacity: 0.35,
    letterSpacing: 0.3,
  },
  topActions: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.floating,
  },
  floatingActions: {
    position: 'absolute',
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    ...Shadows.floating,
  },
  actionLabel: { ...Fonts.body, fontSize: FontSize.sm },
});
