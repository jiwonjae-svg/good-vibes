import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  View, FlatList, StyleSheet, Dimensions, ActivityIndicator, Text, ViewToken,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Fonts, FontSize, Spacing } from '../../constants/theme';
import { useQuoteStore, Quote } from '../../stores/useQuoteStore';
import { useUserStore } from '../../stores/useUserStore';
import { useGrassStore } from '../../stores/useGrassStore';
import { getInitialQuotes, fetchQuoteBatch } from '../../services/quoteService';
import { getPraise } from '../../services/praiseService';
import { saveQuoteForWidget } from '../../services/widgetService';
import { QUOTE_CONFIG } from '../../constants/config';
import { useAdInterstitial } from '../../components/AdInterstitial';
import { todayString } from '../../utils/dateUtils';
import QuoteCard, { CARD_HEIGHT } from '../../components/QuoteCard';
import SpeakAlongSheet from '../../components/SpeakAlongSheet';
import WriteAlongSheet from '../../components/WriteAlongSheet';
import TypeAlongSheet from '../../components/TypeAlongSheet';
import PraiseModal from '../../components/PraiseModal';

type SheetType = 'speak' | 'write' | 'type' | null;

export default function HomeScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { quotes, isLoading, isGenerating, setQuotes, appendQuotes, setIsLoading, setIsGenerating } = useQuoteStore();
  const { incrementScroll, updateStreak, addViewedQuote } = useUserStore();
  const language = useUserStore((s) => s.language);
  const { recordActivity } = useGrassStore();
  const { tryShowAd } = useAdInterstitial();

  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [activeQuoteIndex, setActiveQuoteIndex] = useState(0);
  const [praiseVisible, setPraiseVisible] = useState(false);
  const [praiseText, setPraiseText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const lastViewedIndex = useRef(0);

  const isInitialMount = useRef(true);

  useEffect(() => {
    loadQuotes();
    updateStreak(todayString());
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    loadQuotes();
  }, [language]);

  const loadQuotes = async () => {
    setIsLoading(true);
    try { setQuotes(await getInitialQuotes()); }
    finally { setIsLoading(false); }
  };

  const prefetchMore = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try { appendQuotes(await fetchQuoteBatch()); }
    finally { setIsGenerating(false); }
  }, [isGenerating]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const idx = viewableItems[0].index ?? 0;
        if (idx > lastViewedIndex.current) {
          incrementScroll().then((count) => { if (count % 5 === 0) tryShowAd(); });
        }
        lastViewedIndex.current = idx;
        setActiveQuoteIndex(idx);
        const q = quotes[idx];
        if (q) {
          saveQuoteForWidget(q.text, q.author);
          addViewedQuote(q.id, q.text, todayString());
        }
        if (quotes.length - idx <= QUOTE_CONFIG.prefetchThreshold) prefetchMore();
      }
    },
    [quotes.length, prefetchMore, addViewedQuote],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleActivitySuccess = async (type: 'speak' | 'write' | 'type') => {
    setActiveSheet(null);
    await recordActivity(type);
    await updateStreak(todayString());
    const quoteText = quotes[activeQuoteIndex]?.text ?? '';
    let praise: string;
    try { praise = await getPraise(type, quoteText); }
    catch { praise = t('praise.fallback'); }
    setPraiseText(praise);
    setPraiseVisible(true);
  };

  const activeQuote = quotes[activeQuoteIndex];

  const renderItem = useCallback(
    ({ item, index }: { item: Quote; index: number }) => (
      <QuoteCard
        quote={item}
        onSpeakAlong={() => { setActiveQuoteIndex(index); setActiveSheet('speak'); }}
        onWriteAlong={() => { setActiveQuoteIndex(index); setActiveSheet('write'); }}
        onTypeAlong={() => { setActiveQuoteIndex(index); setActiveSheet('type'); }}
      />
    ), [],
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('home.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={quotes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={CARD_HEIGHT}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({ length: CARD_HEIGHT, offset: CARD_HEIGHT * index, index })}
        ListFooterComponent={isGenerating ? <View style={styles.footer}><ActivityIndicator size="small" color={colors.primary} /></View> : null}
      />
      {activeQuote && (
        <>
          <SpeakAlongSheet visible={activeSheet === 'speak'} quoteText={activeQuote.text} onClose={() => setActiveSheet(null)} onSuccess={() => handleActivitySuccess('speak')} />
          <WriteAlongSheet visible={activeSheet === 'write'} quoteText={activeQuote.text} onClose={() => setActiveSheet(null)} onSuccess={() => handleActivitySuccess('write')} />
          <TypeAlongSheet visible={activeSheet === 'type'} quoteText={activeQuote.text} onClose={() => setActiveSheet(null)} onSuccess={() => handleActivitySuccess('type')} />
        </>
      )}
      <PraiseModal visible={praiseVisible} praise={praiseText} onClose={() => setPraiseVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...Fonts.body, fontSize: FontSize.md, marginTop: Spacing.md },
  footer: { height: 60, justifyContent: 'center', alignItems: 'center' },
});
