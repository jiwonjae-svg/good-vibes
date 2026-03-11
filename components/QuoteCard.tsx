import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, Image, Modal, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { FontSize, Spacing, BorderRadius, Shadows, Fonts } from '../constants/theme';
import { useThemeColors } from '../hooks/useThemeColors';
import type { Quote } from '../stores/useQuoteStore';
import { useUserStore } from '../stores/useUserStore';
import { useAutoPlayStore } from '../stores/useAutoPlayStore';
import { Ionicons } from '@expo/vector-icons';
import { useTTS } from '../hooks/useTTS';
import { useTranslation } from 'react-i18next';
import { shareQuoteText, shareQuoteImage } from '../services/shareService';
import { reportQuote, type ReportReason } from '../services/firestoreUserService';
import { appLog } from '../services/logger';
import LoginPromptModal from './LoginPromptModal';
import PremiumPromptModal from './PremiumPromptModal';
import { onTTSPressed } from './AdInterstitial';

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
  // onToggleAutoPlay removed: QuoteCard manages auto-play state directly
  // via useAutoPlayStore to avoid FlatList re-renders when play state changes.
}

export default function QuoteCard({ quote, onSpeakAlong, onWriteAlong, onTypeAlong }: QuoteCardPropsExtended) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = 65 + Math.max(20, insets.bottom);
  const floatingActionsBottom = tabBarHeight + 16;
  const { speak, stop, isSpeaking } = useTTS();
  const toggleBookmark = useUserStore((s) => s.toggleBookmark);
  const isBookmarked = useUserStore((s) => s.isBookmarked);
  const uid = useUserStore((s) => s.uid);
  const isPremium = useUserStore((s) => s.isPremium);
  const allViewedQuoteIds = useUserStore((s) => s.allViewedQuoteIds);
  const fontSizeMultiplier = useUserStore((s) => s.quoteFontSizeMultiplier);
  const bookmarked = isBookmarked(quote.id);
  const isDark = useUserStore((s) => s.isDarkMode);
  const likedQuoteIds = useUserStore((s) => s.likedQuoteIds);
  const dislikedQuoteIds = useUserStore((s) => s.dislikedQuoteIds);
  const rateQuote = useUserStore((s) => s.rateQuote);
  const isLiked = likedQuoteIds.includes(quote.id);
  const isDisliked = dislikedQuoteIds.includes(quote.id);
  const isAutoPlaying = useAutoPlayStore((s) => s.isAutoPlaying);
  const gradient = colors.cardGradients[quote.gradientIndex % colors.cardGradients.length];
  const actionBg = isDark ? ACTION_BG_DARK : ACTION_BG_LIGHT;
  const isGuest = !uid;
  // Viewed dimming: subtle overlay if this quote was seen in a previous session
  const wasViewed = allViewedQuoteIds.includes(quote.id);

  const [loginPromptVisible, setLoginPromptVisible] = useState(false);
  const [premiumPromptVisible, setPremiumPromptVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  // Ref-based guard prevents concurrent screenshot captures
  const isCapturingRef = useRef(false);

  const viewShotRef = useRef<ViewShot>(null);

  const quoteMarkColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(50,50,50,0.4)';
  const quoteTextColor = isDark ? '#ffffff' : '#2d2d2d';

  const handleTTS = () => {
    if (isSpeaking) {
      stop();
    } else {
      speak(quote.text);
      onTTSPressed(isPremium);
    }
  };
  
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
    // Manage toggle directly to avoid passing a prop that changes on every render
    const { isAutoPlaying: currentlyPlaying, setAutoPlaying } = useAutoPlayStore.getState();
    if (currentlyPlaying) stop();
    setAutoPlaying(!currentlyPlaying);
  };
  
  const handleShare = () => {
    if (isGuest) {
      setLoginPromptVisible(true);
      return;
    }
    shareQuoteText(quote.text, quote.author);
  };

  const handleShareImage = async () => {
    if (isGuest) {
      setLoginPromptVisible(true);
      return;
    }
    // Prevent concurrent captures via ref (state updates are async and can miss rapid taps)
    if (isCapturingRef.current) return;
    isCapturingRef.current = true;
    appLog.log('[quote] shareImage tapped', { id: quote.id });
    try {
      setIsCapturing(true);
      // Allow one render cycle to hide UI before capturing
      await new Promise<void>((resolve) => setTimeout(resolve, 80));
      const uri = await captureRef(viewShotRef, { format: 'png', quality: 1 });
      setIsCapturing(false);
      await shareQuoteImage(uri);
      appLog.log('[quote] shareImage success', { id: quote.id });
    } catch (err) {
      setIsCapturing(false);
      appLog.warn('[quote] shareImage capture failed, falling back to text', { err: String(err) });
      shareQuoteText(quote.text, quote.author);
    } finally {
      isCapturingRef.current = false;
    }
  };

  const handleRateQuote = (rating: 'like' | 'dislike') => {
    if (isGuest) { setLoginPromptVisible(true); return; }
    rateQuote(quote.id, rating);
  };

  const handleAuthorWiki = () => {
    if (!quote.author) return;
    const query = encodeURIComponent(quote.author);
    Linking.openURL(`https://en.wikipedia.org/wiki/Special:Search?search=${query}`);
  };

  const handleReport = () => {
    if (isGuest) {
      setLoginPromptVisible(true);
      return;
    }
    appLog.log('[quote] report modal opened', { id: quote.id });
    setReportModalVisible(true);
  };

  const submitReport = async (reason: ReportReason) => {
    if (!uid || reportSubmitting) return;
    appLog.log('[quote] report submitted', { id: quote.id, reason, uid });
    setReportSubmitting(true);
    setReportModalVisible(false);
    const result = await reportQuote(uid, quote.id, quote.text, reason);
    setReportSubmitting(false);
    if (result.success) {
      appLog.log('[quote] report success', { id: quote.id });
      Alert.alert(t('report.success'), t('report.thanks'));
    } else {
      appLog.warn('[quote] report failed', { id: quote.id });
    }
  };
  
  const handleActivity = (action: () => void) => {
    if (isGuest) {
      setLoginPromptVisible(true);
      return;
    }
    action();
  };

  return (
    <View style={styles.container}>
      <ViewShot ref={viewShotRef} style={styles.viewShotWrapper}>
        <LinearGradient colors={gradient} style={styles.gradient}>
          {wasViewed && (
            <View style={styles.viewedOverlay} pointerEvents="none" />
          )}
          <View style={styles.cardFrame}>
            <View style={styles.quoteContent}>
              <Image
                source={QUOTE_OPEN_IMG}
                style={[styles.quoteMarkOpen, { tintColor: quoteMarkColor }]}
                resizeMode="contain"
              />
              
              <Text style={[styles.quoteText, { color: quoteTextColor, fontSize: getQuoteFontSize(quote.text) * fontSizeMultiplier, lineHeight: getQuoteFontSize(quote.text) * fontSizeMultiplier * 1.45 }]}>{quote.text}</Text>
              
              <Image
                source={QUOTE_CLOSE_IMG}
                style={[styles.quoteMarkClose, { tintColor: quoteMarkColor }]}
                resizeMode="contain"
              />

              {/* Author displayed below the closing quote mark */}
              {quote.author ? (
                <Pressable onPress={handleAuthorWiki} hitSlop={8}>
                  <Text style={[styles.authorText, { color: quoteTextColor, textDecorationLine: 'underline', textDecorationColor: 'rgba(0,0,0,0.25)' }]}>
                    — {quote.author}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* Source shown as a tiny label in the bottom-left corner of the card */}
            {quote.source ? (
              <Text style={[styles.sourceText, { color: quoteTextColor }]}>
                {sourceLabel(quote.source)}
              </Text>
            ) : null}
            
            {isCapturing && (
              <View style={styles.watermark} pointerEvents="none">
                <Text style={styles.watermarkText}>DailyGlow</Text>
              </View>
            )}

            {!isCapturing && (
              <View style={styles.topActions}>
                <Pressable onPress={handleTTS} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
                  <Ionicons name={isSpeaking ? 'volume-high' : 'volume-medium-outline'} size={20} color={colors.textPrimary} />
                </Pressable>
                <Pressable onPress={handleBookmark} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
                  <Ionicons name={bookmarked ? 'heart' : 'heart-outline'} size={20} color={bookmarked ? colors.error : colors.textPrimary} />
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
                <Pressable onPress={handleShareImage} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
                  <Ionicons name="image-outline" size={20} color={colors.textPrimary} />
                </Pressable>
                <Pressable onPress={() => handleRateQuote('like')} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
                  <Ionicons name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'} size={19} color={isLiked ? colors.primary : colors.textPrimary} />
                </Pressable>
                <Pressable onPress={() => handleRateQuote('dislike')} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
                  <Ionicons name={isDisliked ? 'thumbs-down' : 'thumbs-down-outline'} size={19} color={isDisliked ? colors.error : colors.textPrimary} />
                </Pressable>
                <Pressable onPress={handleReport} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
                  <Ionicons name="flag-outline" size={19} color={colors.textSecondary} />
                </Pressable>
              </View>
            )}
          </View>

          {!isCapturing && (
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
          )}

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
      </ViewShot>

      {/* Report Modal */}
      <Modal visible={reportModalVisible} transparent animationType="fade" onRequestClose={() => setReportModalVisible(false)}>
        <Pressable style={styles.reportBackdrop} onPress={() => setReportModalVisible(false)}>
          <View style={[styles.reportSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.reportTitle, { color: colors.textPrimary }]}>{t('report.title')}</Text>
            <Text style={[styles.reportSubtitle, { color: colors.textSecondary }]}>{t('report.reason')}</Text>
            {(['incorrect', 'inappropriate', 'duplicate', 'other'] as ReportReason[]).map((reason) => (
              <Pressable
                key={reason}
                style={[styles.reportOption, { borderColor: colors.surfaceAlt }]}
                onPress={() => submitReport(reason)}
              >
                <Text style={[styles.reportOptionText, { color: colors.textPrimary }]}>
                  {t(`report.reason${reason.charAt(0).toUpperCase()}${reason.slice(1)}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const QUOTE_MARK_SIZE = FontSize.xl * 2;

/**
 * Returns an appropriate font size for the quote text based on its length.
 * CJK (Chinese/Japanese/Korean) scripts pack more information per character
 * so we apply a 1.8× effective-length factor before checking thresholds.
 */
function isCJK(text: string): boolean {
  return /[\u1100-\u11FF\u3040-\u30FF\u3130-\u318F\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/.test(text);
}

function getQuoteFontSize(text: string): number {
  const effectiveLen = isCJK(text) ? text.length * 1.8 : text.length;
  if (effectiveLen < 80)  return FontSize.xl;      // 24px – short quote
  if (effectiveLen < 150) return FontSize.lg;      // 20px – medium
  if (effectiveLen < 260) return FontSize.md + 2; // 18px – long
  return FontSize.md;                              // 16px – very long
}

const styles = StyleSheet.create({
  container: { height: CARD_HEIGHT, width: SCREEN_WIDTH },
  viewShotWrapper: { flex: 1 },
  gradient: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.lg },
  viewedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
    zIndex: 0,
    borderRadius: 0,
  },
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
    paddingTop: Spacing.xxl,   // clear the absolutely-positioned action button row (36px h at top: 16px)
    paddingBottom: Spacing.md,
  },
  quoteMarkOpen: {
    width: QUOTE_MARK_SIZE,
    height: QUOTE_MARK_SIZE,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  quoteText: {
    ...Fonts.quote,
    fontSize: FontSize.xl, // overridden inline by getQuoteFontSize()
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
  watermark: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  watermarkText: {
    ...Fonts.heading,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.5,
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
  reportBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  reportSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
    paddingBottom: 36,
  },
  reportTitle: { ...Fonts.heading, fontSize: FontSize.lg, marginBottom: 4 },
  reportSubtitle: { ...Fonts.body, fontSize: FontSize.sm, marginBottom: 8 },
  reportOption: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reportOptionText: { ...Fonts.body, fontSize: FontSize.md },
});
