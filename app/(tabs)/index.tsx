import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  View, FlatList, StyleSheet, ActivityIndicator, Text, ViewToken,
} from 'react-native';
import { Audio } from 'expo-av';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useTTS } from '../../hooks/useTTS';
import { Fonts, FontSize, Spacing } from '../../constants/theme';
import { useQuoteStore, Quote } from '../../stores/useQuoteStore';
import { useUserStore } from '../../stores/useUserStore';
import { useGrassStore } from '../../stores/useGrassStore';
import { useAutoPlayStore } from '../../stores/useAutoPlayStore';
import { getInitialQuotes, fetchQuoteBatch } from '../../services/quoteService';
import { getPraise } from '../../services/praiseService';
import { saveQuoteForWidget } from '../../services/widgetService';
import { logActivityCompletion } from '../../services/firestoreUserService';
import { QUOTE_CONFIG } from '../../constants/config';
import { useAdInterstitial } from '../../components/AdInterstitial';
import { todayString } from '../../utils/dateUtils';
import QuoteCard, { CARD_HEIGHT } from '../../components/QuoteCard';
import SpeakAlongSheet from '../../components/SpeakAlongSheet';
import WriteAlongSheet from '../../components/WriteAlongSheet';
import TypeAlongSheet from '../../components/TypeAlongSheet';
import PraiseModal from '../../components/PraiseModal';
import LoginPromptModal from '../../components/LoginPromptModal';

type SheetType = 'speak' | 'write' | 'type' | null;

export default function HomeScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { speak, stop, isSpeaking } = useTTS();
  const { quotes, isLoading, isGenerating, setQuotes, appendQuotes, setIsLoading, setIsGenerating } = useQuoteStore();
  const { incrementScroll, updateStreak, addViewedQuote } = useUserStore();
  const language = useUserStore((s) => s.language);
  const autoReadEnabled = useUserStore((s) => s.autoReadEnabled);
  const isPremium = useUserStore((s) => s.isPremium);
  const { recordActivity } = useGrassStore();
  const { tryShowAd } = useAdInterstitial();
  const { isAutoPlaying, setAutoPlaying, intervalSeconds } = useAutoPlayStore();

  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [activeQuoteIndex, setActiveQuoteIndex] = useState(0);
  const [praiseVisible, setPraiseVisible] = useState(false);
  const [praiseText, setPraiseText] = useState('');
  const [loginPromptVisible, setLoginPromptVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const lastViewedIndex = useRef(0);
  const loginPromptShown = useRef(false);
  const lastAutoReadIndex = useRef(-1);
  const autoPlayChainRef = useRef(false);
  const quotesRef = useRef(quotes);
  quotesRef.current = quotes;
  const activeQuoteIndexRef = useRef(0);
  activeQuoteIndexRef.current = activeQuoteIndex;
  const isProgrammaticScrollRef = useRef(false);

  const isInitialMount = useRef(true);
  const uid = useUserStore((s) => s.uid);
  const isGuest = !uid;
  const selectedCategories = useUserStore((s) => s.selectedCategories);

  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch {}
    };
    setupAudio();
    loadQuotes();
  }, []);

  const autoPlayIndexRef = useRef(0);

  const advanceAndSpeakNext = useCallback(() => {
    if (!autoPlayChainRef.current || !useAutoPlayStore.getState().isAutoPlaying) return;
    const qs = useQuoteStore.getState().quotes;
    const nextIdx = autoPlayIndexRef.current + 1;
    autoPlayIndexRef.current = nextIdx;
    if (nextIdx < qs.length) {
      setActiveQuoteIndex(nextIdx);
      isProgrammaticScrollRef.current = true;
      flatListRef.current?.scrollToIndex({ index: nextIdx, animated: true });
      const nextQuote = qs[nextIdx];
      if (nextQuote) {
        speak(nextQuote.text, { onDone: advanceAndSpeakNext });
      }
    } else {
      prefetchMore();
    }
  }, [speak, prefetchMore]);

  useEffect(() => {
    if (isAutoPlaying) {
      // Always read from refs so we get the freshest quotes + index,
      // regardless of which render's closure was captured.
      const qs = quotesRef.current;
      if (qs.length === 0) return;
      autoPlayChainRef.current = true;
      const startIdx = activeQuoteIndexRef.current;
      autoPlayIndexRef.current = startIdx;
      const q = qs[startIdx];
      if (q) {
        speak(q.text, { onDone: advanceAndSpeakNext });
      }
    } else {
      autoPlayChainRef.current = false;
      stop();
    }
  }, [isAutoPlaying]);


  const handleToggleAutoPlay = useCallback(() => {
    if (isAutoPlaying) {
      stop();
    }
    setAutoPlaying(!isAutoPlaying);
  }, [isAutoPlaying, setAutoPlaying, stop]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    loadQuotes();
  }, [language]);

  useEffect(() => {
    if (quotes.length === 0 && !isLoading) {
      loadQuotes();
    }
  }, [selectedCategories, quotes.length, isLoading]);

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
        activeQuoteIndexRef.current = idx;
        const qs = quotesRef.current;
        const q = qs[idx];
        if (q) {
          if (isPremium) {
            saveQuoteForWidget(q.text, q.author, q.category);
          }
          if (viewableItems.length === 1) {
            addViewedQuote(q.id, q.text, q.author, q.source ?? '', todayString());
          }

          if (autoPlayChainRef.current) {
            if (isProgrammaticScrollRef.current) {
              // programmatic scroll from advanceAndSpeakNext — TTS already started, just clear flag
              isProgrammaticScrollRef.current = false;
            } else {
              // user manually scrolled during auto-play → jump to new quote immediately
              stop();
              autoPlayIndexRef.current = idx;
              speak(q.text, { onDone: advanceAndSpeakNext });
            }
          } else if (autoReadEnabled && idx !== lastAutoReadIndex.current) {
            // Capture idx in closure so we cancel the speak if the user
            // scrolls to a different quote before the 300ms delay fires.
            const speakIdx = idx;
            lastAutoReadIndex.current = idx;
            setTimeout(() => {
              if (lastAutoReadIndex.current === speakIdx) speak(q.text);
            }, 300);
          }
        }
        if (qs.length - idx <= QUOTE_CONFIG.prefetchThreshold) prefetchMore();

        if (isGuest && idx >= 7 && !loginPromptShown.current) {
          loginPromptShown.current = true;
          setTimeout(() => setLoginPromptVisible(true), 300);
        }
      }
    },
    [quotes.length, prefetchMore, addViewedQuote, isGuest, autoReadEnabled, speak, stop, advanceAndSpeakNext, isPremium],
  );

  const onMomentumScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      const idx = Math.round(e.nativeEvent.contentOffset.y / CARD_HEIGHT);
      const qs = quotesRef.current;
      const q = qs[idx];
      if (q) {
        addViewedQuote(q.id, q.text, q.author, q.source ?? '', todayString());
      }
    },
    [addViewedQuote],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleActivitySuccess = async (type: 'speak' | 'write' | 'type') => {
    setActiveSheet(null);
    
    const currentQuote = quotes[activeQuoteIndex];
    const quoteText = currentQuote?.text ?? '';
    
    if (!isGuest && currentQuote && uid) {
      await recordActivity(type, currentQuote.id, currentQuote.text);
      await updateStreak(todayString());
      const activityType = type === 'speak' ? 'speak_along' : type === 'write' ? 'write_along' : 'type_along';
      logActivityCompletion(uid, activityType);
    }
    
    let praise: string;
    try { praise = await getPraise(type, quoteText); }
    catch { praise = t('praise.fallback'); }
    setPraiseText(praise);
    setPraiseVisible(true);
    
    if (isGuest && !loginPromptShown.current) {
      loginPromptShown.current = true;
      setTimeout(() => setLoginPromptVisible(true), 2000);
    }
  };

  const activeQuote = quotes[activeQuoteIndex];

  const renderItem = useCallback(
    ({ item, index }: { item: Quote; index: number }) => (
      <QuoteCard
        quote={item}
        onSpeakAlong={() => { setActiveQuoteIndex(index); setActiveSheet('speak'); }}
        onWriteAlong={() => { setActiveQuoteIndex(index); setActiveSheet('write'); }}
        onTypeAlong={() => { setActiveQuoteIndex(index); setActiveSheet('type'); }}
        onToggleAutoPlay={handleToggleAutoPlay}
      />
    ), [handleToggleAutoPlay],
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
        onMomentumScrollEnd={onMomentumScrollEnd}
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
      <LoginPromptModal
        visible={loginPromptVisible}
        onClose={() => setLoginPromptVisible(false)}
        description={t('guest.loginPromptDesc')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...Fonts.body, fontSize: FontSize.md, marginTop: Spacing.md },
  footer: { height: 60, justifyContent: 'center', alignItems: 'center' },
});
