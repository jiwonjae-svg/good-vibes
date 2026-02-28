import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius, LightColors } from '../../constants/theme';
import { useUserStore } from '../../stores/useUserStore';
import { useQuoteStore, Quote } from '../../stores/useQuoteStore';

export default function MyScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { bookmarkedQuoteIds, todayViewedQuoteIds, todayViewedDate, toggleBookmark } = useUserStore();
  const quotes = useQuoteStore((s) => s.quotes);

  const [selectedQuote, setSelectedQuote] = useState<{ text: string; author?: string; gradientIndex?: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'bookmarked' | 'today'>('bookmarked');

  const bookmarkedQuotes = quotes.filter((q) => bookmarkedQuoteIds.includes(q.id));

  const todayQuotes = todayViewedQuoteIds.map((q) => {
    const [id, ...textParts] = q.split('|');
    return { id, text: textParts.join('|') };
  });

  const handleQuotePress = (quote: { text: string; author?: string; gradientIndex?: number }) => {
    setSelectedQuote(quote);
  };

  const renderBookmarkedItem = useCallback(({ item }: { item: Quote }) => (
    <Pressable
      style={[styles.quoteItem, { backgroundColor: colors.surface }]}
      onPress={() => handleQuotePress(item)}
    >
      <View style={styles.quoteContent}>
        <Text style={[styles.quoteText, { color: colors.textPrimary }]} numberOfLines={3}>
          "{item.text}"
        </Text>
        {item.author && (
          <Text style={[styles.authorText, { color: colors.textSecondary }]}>— {item.author}</Text>
        )}
      </View>
      <Pressable onPress={() => toggleBookmark(item.id)} hitSlop={10}>
        <Ionicons name="bookmark" size={22} color={colors.primary} />
      </Pressable>
    </Pressable>
  ), [colors, toggleBookmark]);

  const renderTodayItem = useCallback(({ item }: { item: { id: string; text: string } }) => (
    <Pressable
      style={[styles.quoteItem, { backgroundColor: colors.surface }]}
      onPress={() => handleQuotePress({ text: item.text, gradientIndex: Math.floor(Math.random() * LightColors.cardGradients.length) })}
    >
      <View style={styles.quoteContent}>
        <Text style={[styles.quoteText, { color: colors.textPrimary }]} numberOfLines={3}>
          "{item.text}"
        </Text>
      </View>
      <Ionicons name="eye-outline" size={20} color={colors.textMuted} />
    </Pressable>
  ), [colors]);

  const s = styles;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={s.header}>
        <Text style={[s.title, { color: colors.textPrimary }]}>{t('my.title')}</Text>
      </View>

      {/* Tabs */}
      <View style={[s.tabRow, { backgroundColor: colors.surfaceAlt }]}>
        <Pressable
          style={[s.tab, activeTab === 'bookmarked' && { backgroundColor: colors.surface }]}
          onPress={() => setActiveTab('bookmarked')}
        >
          <Ionicons
            name="bookmark"
            size={18}
            color={activeTab === 'bookmarked' ? colors.primary : colors.textMuted}
          />
          <Text style={[s.tabText, { color: activeTab === 'bookmarked' ? colors.primary : colors.textMuted }]}>
            {t('my.saved')} ({bookmarkedQuotes.length})
          </Text>
        </Pressable>
        <Pressable
          style={[s.tab, activeTab === 'today' && { backgroundColor: colors.surface }]}
          onPress={() => setActiveTab('today')}
        >
          <Ionicons
            name="today"
            size={18}
            color={activeTab === 'today' ? colors.primary : colors.textMuted}
          />
          <Text style={[s.tabText, { color: activeTab === 'today' ? colors.primary : colors.textMuted }]}>
            {t('my.today')} ({todayQuotes.length})
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {activeTab === 'bookmarked' ? (
        bookmarkedQuotes.length === 0 ? (
          <View style={s.emptyContainer}>
            <Ionicons name="bookmark-outline" size={48} color={colors.textMuted} />
            <Text style={[s.emptyText, { color: colors.textSecondary }]}>{t('my.noSaved')}</Text>
            <Text style={[s.emptyHint, { color: colors.textMuted }]}>{t('my.noSavedHint')}</Text>
          </View>
        ) : (
          <FlatList
            data={bookmarkedQuotes}
            keyExtractor={(item) => item.id}
            renderItem={renderBookmarkedItem}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        todayQuotes.length === 0 ? (
          <View style={s.emptyContainer}>
            <Ionicons name="eye-outline" size={48} color={colors.textMuted} />
            <Text style={[s.emptyText, { color: colors.textSecondary }]}>{t('my.noToday')}</Text>
            <Text style={[s.emptyHint, { color: colors.textMuted }]}>{t('my.noTodayHint')}</Text>
          </View>
        ) : (
          <FlatList
            data={todayQuotes}
            keyExtractor={(item) => item.id}
            renderItem={renderTodayItem}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
          />
        )
      )}

      {/* Quote Card Modal */}
      <Modal
        visible={!!selectedQuote}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedQuote(null)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setSelectedQuote(null)}>
          <View style={s.modalCard}>
            <LinearGradient
              colors={LightColors.cardGradients[selectedQuote?.gradientIndex ?? 0]}
              style={s.gradientCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Pressable onPress={() => setSelectedQuote(null)} style={s.closeBtn}>
                <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.8)" />
              </Pressable>
              <Text style={s.quoteMarkStart}>"</Text>
              <Text style={s.modalQuoteText}>{selectedQuote?.text}</Text>
              <Text style={s.quoteMarkEnd}>"</Text>
              {selectedQuote?.author && (
                <Text style={s.modalAuthor}>— {selectedQuote.author}</Text>
              )}
            </LinearGradient>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title: { ...Fonts.heading, fontSize: FontSize.xl },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quoteContent: { flex: 1, marginRight: Spacing.sm },
  quoteText: { ...Fonts.body, fontSize: FontSize.sm, lineHeight: 20 },
  authorText: { ...Fonts.body, fontSize: FontSize.xs, marginTop: Spacing.xs },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  emptyText: { ...Fonts.heading, fontSize: FontSize.md, marginTop: Spacing.md },
  emptyHint: { ...Fonts.body, fontSize: FontSize.sm, marginTop: Spacing.xs, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modalCard: { width: '100%', maxWidth: 360 },
  gradientCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    minHeight: 280,
    justifyContent: 'center',
  },
  closeBtn: { position: 'absolute', top: Spacing.md, right: Spacing.md },
  quoteMarkStart: { ...Fonts.heading, fontSize: 48, color: 'rgba(255,255,255,0.6)', marginBottom: -Spacing.md },
  modalQuoteText: { ...Fonts.heading, fontSize: FontSize.lg, color: '#fff', textAlign: 'center', lineHeight: 28 },
  quoteMarkEnd: { ...Fonts.heading, fontSize: 48, color: 'rgba(255,255,255,0.6)', marginTop: -Spacing.md },
  modalAuthor: { ...Fonts.body, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: Spacing.md },
});
