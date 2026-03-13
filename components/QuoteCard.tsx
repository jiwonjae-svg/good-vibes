import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, Image, Modal, Alert, Linking, ActivityIndicator } from 'react-native';
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
import CommunityBadge from './CommunityBadge';
import { useCommunityStore } from '../stores/useCommunityStore';

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
  onSubmitterPress?: (submitterId: string, submitterName: string, submitterPhotoURL?: string | null) => void;
}

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
export const CARD_HEIGHT = SCREEN_HEIGHT;

interface QuoteCardPropsExtended extends QuoteCardProps {
  // onToggleAutoPlay removed: QuoteCard manages auto-play state directly
  // via useAutoPlayStore to avoid FlatList re-renders when play state changes.
}

export default function QuoteCard({ quote, onSpeakAlong, onWriteAlong, onTypeAlong, onSubmitterPress }: QuoteCardPropsExtended) {
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
  const [showOverflow, setShowOverflow] = useState(false);

  // Community-specific state (only active when quote.source === 'community')
  const isCommunityQuote = quote.source === 'community';
  const likedCommunityIds = useCommunityStore((s) => s.likedCommunityIds);
  const toggleCommunityLike = useCommunityStore((s) => s.toggleLike);
  const reportedCommunityIds = useCommunityStore((s) => s.reportedCommunityIds);
  const communityReportQuote = useCommunityStore((s) => s.reportQuote);
  const isCommunityLiked = likedCommunityIds.includes(quote.id);
  const isCommunityReported = isCommunityQuote && reportedCommunityIds.includes(quote.id);

  // Translation state (community quotes only)
  const language = useUserStore((s) => s.language);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  // Reset translation when quote changes
  useEffect(() => {
    setTranslatedText(null);
    setShowTranslation(false);
  }, [quote.id]);

  const TO_LANG_CODE: Record<string, string> = { ko: 'ko', en: 'en', ja: 'ja', zh: 'zh-CN', es: 'es' };

  const handleTranslate = async () => {
    if (showTranslation && translatedText) {
      setShowTranslation(false);
      return;
    }
    setShowTranslation(true);
    if (translatedText) return;
    setIsTranslating(true);
    try {
      const langCode = TO_LANG_CODE[language] ?? language;
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${langCode}&dt=t&q=${encodeURIComponent(quote.text)}`;
      const resp = await fetch(url);
      const data = await resp.json();
      const translated = (data[0] as [string, ...unknown[]][]).map((chunk) => chunk[0]).join('');
      setTranslatedText(translated);
    } catch {
      setTranslatedText(null);
      setShowTranslation(false);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCommunityLike = () => {
    if (isGuest) { setLoginPromptVisible(true); return; }
    if (uid) toggleCommunityLike(uid, quote.id);
  };
  // Ref-based guard prevents concurrent screenshot captures
  const isCapturingRef = useRef(false);
  const lastTapRef = useRef<number>(0);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      handleBookmark();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handleSourceOpen = () => {
    const urls: Record<string, string> = {
      quotable: 'https://quotable.io',
      wikiquote: 'https://en.wikiquote.org',
      gutenberg: 'https://www.gutenberg.org',
    };
    const url = quote.source ? urls[quote.source] : null;
    if (url) Linking.openURL(url);
  };

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
    // For community quotes, bookmark acts as the community like
    if (isCommunityQuote && uid) {
      toggleCommunityLike(uid, quote.id);
    }
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
    if (isCommunityQuote) {
      await communityReportQuote(uid, quote.id, reason);
      setReportSubmitting(false);
      Alert.alert(t('report.success'), t('report.thanks'));
    } else {
      const result = await reportQuote(uid, quote.id, quote.text, reason);
      setReportSubmitting(false);
      if (result.success) {
        appLog.log('[quote] report success', { id: quote.id });
        Alert.alert(t('report.success'), t('report.thanks'));
      } else {
        appLog.warn('[quote] report failed', { id: quote.id });
      }
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

          {/* Community submitter header */}
          {isCommunityQuote && quote.submitterId && !isCapturing && (
            <Pressable
              style={[styles.submitterHeader, { top: insets.top + 12 }]}
              onPress={() =>
                onSubmitterPress && quote.submitterId
                  ? onSubmitterPress(quote.submitterId, quote.submitterName ?? '', quote.submitterPhotoURL)
                  : undefined
              }
              hitSlop={8}
            >
              <View style={styles.submitterAvatar}>
                {quote.submitterPhotoURL ? (
                  <Image source={{ uri: quote.submitterPhotoURL }} style={styles.submitterAvatarImg} />
                ) : (
                  <Text style={styles.submitterAvatarInitial}>
                    {(quote.submitterName ?? '?').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={styles.submitterName} numberOfLines={1}>{quote.submitterName ?? ''}</Text>
            </Pressable>
          )}
          <View style={styles.cardFrame}>
            <Pressable style={styles.quoteContent} onPress={handleDoubleTap}>
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
                isCommunityQuote ? (
                  <Text style={[styles.authorText, { color: quoteTextColor }]}>
                    — {quote.author}
                  </Text>
                ) : (
                  <Pressable onPress={handleAuthorWiki} hitSlop={8}>
                    <Text style={[styles.authorText, { color: quoteTextColor, textDecorationLine: 'underline', textDecorationColor: 'rgba(0,0,0,0.25)' }]}>
                      — {quote.author}
                    </Text>
                  </Pressable>
                )
              ) : null}

              {/* Inline translation — shown when user taps the language button */}
              {isCommunityQuote && showTranslation && translatedText ? (
                <View style={[styles.translationBubble, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
                  <Ionicons name="language-outline" size={11} color={quoteTextColor} style={{ opacity: 0.7, marginBottom: 2 }} />
                  <Text style={[styles.translationText, { color: quoteTextColor }]}>{translatedText}</Text>
                </View>
              ) : null}
            </Pressable>

            {/* Source shown as a tappable label or Community badge in the bottom-left corner */}
            {isCommunityQuote ? (
              <View style={styles.sourceLink}>
                <CommunityBadge size="sm" />
              </View>
            ) : quote.source ? (
              <Pressable onPress={handleSourceOpen} style={styles.sourceLink}>
                <Ionicons name="link-outline" size={10} color={quoteTextColor} />
                <Text style={[styles.sourceText, { color: quoteTextColor }]}>
                  {sourceLabel(quote.source)}
                </Text>
              </Pressable>
            ) : null}
            
            {isCapturing && (
              <View style={styles.watermark} pointerEvents="none">
                <Text style={styles.watermarkText}>DailyGlow</Text>
              </View>
            )}

            {!isCapturing && (
              <View style={styles.topActionsWrapper}>
                <View style={styles.topActions}>
                  <Pressable onPress={handleTTS} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
                    <Ionicons name={isSpeaking ? 'volume-high' : 'volume-medium-outline'} size={20} color={colors.textPrimary} />
                  </Pressable>
                  <Pressable onPress={handleBookmark} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
                    <Ionicons name={(bookmarked || isCommunityLiked) ? 'heart' : 'heart-outline'} size={20} color={(bookmarked || isCommunityLiked) ? colors.error : colors.textPrimary} />
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
                  <Pressable onPress={() => setShowOverflow(v => !v)} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
                    <Ionicons name={showOverflow ? 'close' : 'ellipsis-horizontal'} size={20} color={colors.textPrimary} />
                  </Pressable>
                </View>
                {showOverflow && (
                  <View style={styles.topActions}>
                    <Pressable onPress={handleShareImage} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
                      <Ionicons name="image-outline" size={20} color={colors.textPrimary} />
                    </Pressable>
                    {isCommunityQuote ? (
                      <>
                        <Pressable onPress={handleTranslate} style={[styles.iconBtn, { backgroundColor: actionBg }]} disabled={isTranslating}>
                          {isTranslating ? (
                            <ActivityIndicator size="small" color={colors.textPrimary} />
                          ) : (
                            <Ionicons name="language-outline" size={20} color={showTranslation ? colors.primary : colors.textPrimary} />
                          )}
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Pressable onPress={() => handleRateQuote('like')} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
                          <Ionicons name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'} size={19} color={isLiked ? colors.primary : colors.textPrimary} />
                        </Pressable>
                        <Pressable onPress={() => handleRateQuote('dislike')} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
                          <Ionicons name={isDisliked ? 'thumbs-down' : 'thumbs-down-outline'} size={19} color={isDisliked ? colors.error : colors.textPrimary} />
                        </Pressable>
                      </>
                    )}
                    <Pressable onPress={handleReport} style={[styles.iconBtn, { backgroundColor: actionBg, opacity: isCommunityReported ? 0.5 : 1 }]} disabled={isCommunityReported}>
                      <Ionicons name={isCommunityReported ? 'flag' : 'flag-outline'} size={19} color={isCommunityReported ? colors.error : colors.textSecondary} />
                    </Pressable>
                  </View>
                )}
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
  submitterHeader: {
    position: 'absolute',
    left: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    zIndex: 30,
  },
  submitterAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  submitterAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  submitterAvatarInitial: {
    ...Fonts.heading,
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.9)',
  },
  submitterName: {
    ...Fonts.body,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    maxWidth: 140,
  },
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
    paddingTop: 60,   // clear the absolutely-positioned action button row (44px h at top: 12px)
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
  translationBubble: {
    alignSelf: 'stretch',
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  translationText: {
    ...Fonts.body,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.88,
    fontStyle: 'italic',
  },
  sourceLink: {
    position: 'absolute',
    bottom: 6,
    left: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    opacity: 0.35,
  },
  sourceText: {
    fontSize: 9,
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
  topActionsWrapper: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  topActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
