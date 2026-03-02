import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Modal, Dimensions, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useUserStore } from '../../stores/useUserStore';
import { useQuoteStore, Quote } from '../../stores/useQuoteStore';
import { useTTS } from '../../hooks/useTTS';
import { shareQuoteText } from '../../services/shareService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACTION_BG_LIGHT = 'rgba(255,255,255,0.92)';
const ACTION_BG_DARK = 'rgba(30,30,30,0.85)';

const QUOTE_OPEN_IMG = require('../../assets/double quotes-front.png');
const QUOTE_CLOSE_IMG = require('../../assets/double quotes-back.png');
const QUOTE_MARK_SIZE = FontSize.lg * 2;

interface QuoteModalProps {
  quote: { id: string; text: string; author?: string; gradientIndex: number } | null;
  onClose: () => void;
  onSpeak: () => void;
  onWrite: () => void;
  onType: () => void;
}

function QuoteModal({ quote, onClose, onSpeak, onWrite, onType }: QuoteModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { speak, stop, isSpeaking } = useTTS();
  const { toggleBookmark, isBookmarked, uid, isDarkMode } = useUserStore();
  const bookmarked = quote ? isBookmarked(quote.id) : false;
  const isGuest = !uid;

  if (!quote) return null;

  const handleTTS = () => (isSpeaking ? stop() : speak(quote.text));
  const handleShare = () => shareQuoteText(quote.text, quote.author);

  const quoteMarkColor = isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(50,50,50,0.4)';
  const quoteTextColor = isDarkMode ? '#ffffff' : '#2d2d2d';
  const actionBg = isDarkMode ? ACTION_BG_DARK : ACTION_BG_LIGHT;

  return (
    <Modal visible={!!quote} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={colors.cardGradients[quote.gradientIndex % colors.cardGradients.length]}
            style={styles.gradientCard}
          >
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close-circle" size={32} color="rgba(255,255,255,0.8)" />
            </Pressable>

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
                {quote.author && (
                  <Text style={[styles.author, { color: isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(50,50,50,0.7)' }]}>
                    - {quote.author}
                  </Text>
                )}
              </View>

              <View style={styles.cardActions}>
                <Pressable onPress={handleTTS} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
                  <Ionicons name={isSpeaking ? 'volume-high' : 'volume-medium-outline'} size={20} color={colors.textPrimary} />
                </Pressable>
                {!isGuest && (
                  <Pressable onPress={() => toggleBookmark(quote.id)} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
                    <Ionicons name={bookmarked ? 'heart' : 'heart-outline'} size={20} color={bookmarked ? '#FF6B6B' : colors.textPrimary} />
                  </Pressable>
                )}
                {!isGuest && (
                  <Pressable onPress={handleShare} style={[styles.iconBtn, { backgroundColor: actionBg }]}>
                    <Ionicons name="share-social-outline" size={20} color={colors.textPrimary} />
                  </Pressable>
                )}
              </View>
            </View>

            {!isGuest && (
              <View style={styles.followActions}>
                <Pressable style={[styles.followBtn, { backgroundColor: actionBg }]} onPress={onSpeak}>
                  <Ionicons name="mic-outline" size={20} color={colors.textPrimary} />
                  <Text style={[styles.followLabel, { color: colors.textPrimary }]}>{t('home.speakAlong')}</Text>
                </Pressable>
                <Pressable style={[styles.followBtn, { backgroundColor: actionBg }]} onPress={onWrite}>
                  <Ionicons name="pencil-outline" size={20} color={colors.textPrimary} />
                  <Text style={[styles.followLabel, { color: colors.textPrimary }]}>{t('home.writeAlong')}</Text>
                </Pressable>
                <Pressable style={[styles.followBtn, { backgroundColor: actionBg }]} onPress={onType}>
                  <Ionicons name="keypad-outline" size={20} color={colors.textPrimary} />
                  <Text style={[styles.followLabel, { color: colors.textPrimary }]}>{t('home.typeAlong')}</Text>
                </Pressable>
              </View>
            )}
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function MyScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const { bookmarkedQuoteIds, todayViewedQuoteIds, toggleBookmark, uid } = useUserStore();
  const quotes = useQuoteStore((s) => s.quotes);
  const isGuest = !uid;

  const [selectedQuote, setSelectedQuote] = useState<{ id: string; text: string; author?: string; gradientIndex: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'bookmarked' | 'today'>('bookmarked');

  const bookmarkedQuotes = quotes.filter((q) => bookmarkedQuoteIds.includes(q.id));

  const todayQuotes = todayViewedQuoteIds.map((q, idx) => {
    const [id, ...textParts] = q.split('|');
    return { id, text: textParts.join('|'), gradientIndex: idx % colors.cardGradients.length };
  });

  const handleQuotePress = (quote: { id: string; text: string; author?: string; gradientIndex: number }) => {
    setSelectedQuote(quote);
  };

  const handleFollowAction = (action: 'speak' | 'write' | 'type') => {
    setSelectedQuote(null);
    router.push('/');
  };

  const renderBookmarkedItem = useCallback(({ item }: { item: Quote }) => (
    <Pressable
      style={[styles.quoteItem, { backgroundColor: colors.surface }]}
      onPress={() => handleQuotePress({ ...item, gradientIndex: item.gradientIndex })}
    >
      <View style={styles.quoteItemContent}>
        <Text style={[styles.quoteItemText, { color: colors.textPrimary }]} numberOfLines={2}>
          {item.text}
        </Text>
        {item.author && (
          <Text style={[styles.quoteItemAuthor, { color: colors.textSecondary }]}>- {item.author}</Text>
        )}
      </View>
      <Pressable onPress={() => toggleBookmark(item.id)} hitSlop={10}>
        <Ionicons name="heart" size={22} color="#FF6B6B" />
      </Pressable>
    </Pressable>
  ), [colors, toggleBookmark]);

  const renderTodayItem = useCallback(({ item, index }: { item: { id: string; text: string; gradientIndex: number }; index: number }) => (
    <Pressable
      style={[styles.quoteItem, { backgroundColor: colors.surface }]}
      onPress={() => handleQuotePress(item)}
    >
      <View style={styles.quoteItemContent}>
        <Text style={[styles.quoteItemText, { color: colors.textPrimary }]} numberOfLines={2}>
          {item.text}
        </Text>
      </View>
      <Ionicons name="eye-outline" size={20} color={colors.textMuted} />
    </Pressable>
  ), [colors]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('my.title')}</Text>
      </View>

      {isGuest && (
        <View style={[styles.guestNotice, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.guestText, { color: colors.textSecondary }]}>{t('my.guestNotice')}</Text>
        </View>
      )}

      <View style={[styles.tabRow, { backgroundColor: colors.surfaceAlt }]}>
        <Pressable
          style={[styles.tab, activeTab === 'bookmarked' && { backgroundColor: colors.surface }]}
          onPress={() => setActiveTab('bookmarked')}
        >
          <Ionicons
            name="heart"
            size={18}
            color={activeTab === 'bookmarked' ? '#FF6B6B' : colors.textMuted}
          />
          <Text style={[styles.tabText, { color: activeTab === 'bookmarked' ? colors.primary : colors.textMuted }]}>
            {t('my.saved')} ({bookmarkedQuotes.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'today' && { backgroundColor: colors.surface }]}
          onPress={() => setActiveTab('today')}
        >
          <Ionicons
            name="today"
            size={18}
            color={activeTab === 'today' ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.tabText, { color: activeTab === 'today' ? colors.primary : colors.textMuted }]}>
            {t('my.today')} ({todayQuotes.length})
          </Text>
        </Pressable>
      </View>

      {activeTab === 'bookmarked' ? (
        bookmarkedQuotes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('my.noSaved')}</Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t('my.noSavedHint')}</Text>
          </View>
        ) : (
          <FlatList
            data={bookmarkedQuotes}
            keyExtractor={(item) => item.id}
            renderItem={renderBookmarkedItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        todayQuotes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="eye-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('my.noToday')}</Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t('my.noTodayHint')}</Text>
          </View>
        ) : (
          <FlatList
            data={todayQuotes}
            keyExtractor={(item) => item.id}
            renderItem={renderTodayItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )
      )}

      <QuoteModal
        quote={selectedQuote}
        onClose={() => setSelectedQuote(null)}
        onSpeak={() => handleFollowAction('speak')}
        onWrite={() => handleFollowAction('write')}
        onType={() => handleFollowAction('type')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title: { ...Fonts.heading, fontSize: FontSize.xl },
  guestNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  guestText: { ...Fonts.body, fontSize: FontSize.sm, flex: 1 },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  tabText: { ...Fonts.body, fontSize: FontSize.sm },
  listContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl },
  quoteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    ...Shadows.floating,
  },
  quoteItemContent: { flex: 1, marginRight: Spacing.sm },
  quoteItemText: { ...Fonts.body, fontSize: FontSize.sm, lineHeight: 20 },
  quoteItemAuthor: { ...Fonts.body, fontSize: FontSize.xs, marginTop: Spacing.xs, fontStyle: 'italic' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  emptyText: { ...Fonts.heading, fontSize: FontSize.md, marginTop: Spacing.md },
  emptyHint: { ...Fonts.body, fontSize: FontSize.sm, marginTop: Spacing.xs, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modalContent: { width: '100%', maxWidth: 380 },
  gradientCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  closeBtn: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, zIndex: 10 },
  cardFrame: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    padding: Spacing.lg,
    marginTop: Spacing.md,
    position: 'relative',
  },
  quoteContent: { alignItems: 'center', paddingVertical: Spacing.sm },
  quoteMarkOpen: {
    width: QUOTE_MARK_SIZE,
    height: QUOTE_MARK_SIZE,
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs,
  },
  quoteText: {
    ...Fonts.quote,
    fontSize: FontSize.lg,
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: Spacing.sm,
  },
  quoteMarkClose: {
    width: QUOTE_MARK_SIZE,
    height: QUOTE_MARK_SIZE,
    alignSelf: 'flex-end',
    marginTop: Spacing.xs,
  },
  author: {
    ...Fonts.body,
    fontSize: FontSize.sm,
    marginTop: Spacing.md,
    fontStyle: 'italic',
  },
  cardActions: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.floating,
  },
  followActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    ...Shadows.floating,
  },
  followLabel: { ...Fonts.body, fontSize: FontSize.xs },
});
