import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  View, FlatList, StyleSheet, ActivityIndicator, Text, ViewToken, Pressable, Image, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useTTS } from '../../hooks/useTTS';
import { Fonts, FontSize, Spacing } from '../../constants/theme';
import { useQuoteStore, Quote } from '../../stores/useQuoteStore';
import { useUserStore } from '../../stores/useUserStore';
import { useGrassStore } from '../../stores/useGrassStore';
import { useAutoPlayStore } from '../../stores/useAutoPlayStore';
import { getInitialQuotes, fetchQuoteBatch, findQuoteById, getAllQuotesForSearch } from '../../services/quoteService';
import { getPraise } from '../../services/praiseService';
import { saveQuoteForWidget, saveStreakForWidget, saveQuotesBufferForWidget, WidgetQuoteData } from '../../services/widgetService';
import { logActivityCompletion, fetchFollowedUserIds } from '../../services/firestoreUserService';
import { appLog } from '../../services/logger';
import { QUOTE_CONFIG } from '../../constants/config';
import { useAdInterstitial, showAdForActivity } from '../../components/AdInterstitial';
import { todayString } from '../../utils/dateUtils';
import QuoteCard, { CARD_HEIGHT } from '../../components/QuoteCard';
import SpeakAlongSheet from '../../components/SpeakAlongSheet';
import WriteAlongSheet from '../../components/WriteAlongSheet';
import TypeAlongSheet from '../../components/TypeAlongSheet';
import LoginPromptModal from '../../components/LoginPromptModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DailyQuoteModal, { getDailyQuote } from '../../components/DailyQuoteModal';

const PENCIL_ICON = require('../../assets/pencil-elem-icon.png');
import QuoteSearchModal from '../../components/QuoteSearchModal';
import OfflineBanner from '../../components/OfflineBanner';
import MilestoneBadgeModal from '../../components/MilestoneBadgeModal';
import SubmitQuoteSheet from '../../components/SubmitQuoteSheet';
import { useCommunityStore } from '../../stores/useCommunityStore';
import { Ionicons } from '@expo/vector-icons';
import UserProfileModal from '../../components/UserProfileModal';

type SheetType = 'speak' | 'write' | 'type' | null;

export default function HomeScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { speak, stop, isSpeaking } = useTTS();
  const { quotes, isLoading, isGenerating, setQuotes, appendQuotes, setIsLoading, setIsGenerating } = useQuoteStore();
  const { incrementScroll, updateStreak, addViewedQuote, clearNewBadge } = useUserStore();
  const trackCategoryView = useUserStore((s) => s.trackCategoryView);
  const newBadgeEarned = useUserStore((s) => s.newBadgeEarned);
  const currentStreak = useUserStore((s) => s.currentStreak);
  const language = useUserStore((s) => s.language);
  const autoReadEnabled = useUserStore((s) => s.autoReadEnabled);
  const isPremium = useUserStore((s) => s.isPremium);
  const { recordActivity } = useGrassStore();
  const { tryShowAd } = useAdInterstitial();
  const { isAutoPlaying, setAutoPlaying, intervalSeconds } = useAutoPlayStore();

  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [activeQuoteIndex, setActiveQuoteIndex] = useState(0);
  const [loginPromptVisible, setLoginPromptVisible] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchPool, setSearchPool] = useState<Quote[]>([]);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [submitVisible, setSubmitVisible] = useState(false);
  const [profileTarget, setProfileTarget] = useState<{ uid: string; name: string; photoURL?: string | null } | null>(null);

  const showCommunityQuotes = useUserStore((s) => s.showCommunityQuotes);
  const uid = useUserStore((s) => s.uid);

  // Community feed
  const {
    communityQuotes, isLoading: communityLoading,
    hasMore: communityHasMore,
    loadCommunityQuotes, loadMore: loadMoreCommunity,
    init: initCommunityStore,
    setFollowedUids,
  } = useCommunityStore();

  // Interleave community quotes into the main feed (every 5th slot) when enabled
  const displayedQuotes: Quote[] = React.useMemo(() => {
    if (!showCommunityQuotes || communityQuotes.length === 0) return quotes;
    const merged: Quote[] = [];
    let ci = 0;
    for (let i = 0; i < quotes.length; i++) {
      merged.push(quotes[i]);
      if ((i + 1) % 5 === 0 && ci < communityQuotes.length) {
        const cq = communityQuotes[ci++];
        merged.push({
          id: cq.id,
          text: cq.text,
          author: cq.author,
          source: 'community' as const,
          category: cq.categories[0],
          createdAt: cq.createdAt,
          gradientIndex: i % 8,
          submitterId: cq.submitterId,
          submitterName: cq.submitterName,
          submitterPhotoURL: cq.submitterPhotoURL,
        });
      }
    }
    return merged;
  }, [quotes, communityQuotes, showCommunityQuotes]);
  const flatListRef = useRef<FlatList>(null);
  const lastViewedIndex = useRef(0);
  const loginPromptShown = useRef(false);
  const lastAutoReadIndex = useRef(-1);
  const autoPlayChainRef = useRef(false);
  const quotesRef = useRef(quotes);
  quotesRef.current = quotes;
  // Tracks displayedQuotes (native + community) for view-event handling
  const displayedQuotesRef = useRef(displayedQuotes);
  displayedQuotesRef.current = displayedQuotes;
  const activeQuoteIndexRef = useRef(0);
  activeQuoteIndexRef.current = activeQuoteIndex;
  const isProgrammaticScrollRef = useRef(false);
  const pendingQuoteIdRef = useRef<string | null>(null);

  const isInitialMount = useRef(true);
  const dailyModalShownRef = useRef(false);
  const widgetSavedRef = useRef(false);
  const isGuest = !uid;
  const selectedCategories = useUserStore((s) => s.selectedCategories);

  // Load followed UIDs when the user logs in/out; clear on logout
  useEffect(() => {
    if (!uid) {
      setFollowedUids([]);
      return;
    }
    fetchFollowedUserIds(uid).then(setFollowedUids).catch(() => {});
  }, [uid]);

  // Save today's daily quote to widget when quotes first load (all users)
  useEffect(() => {
    if (quotes.length === 0 || widgetSavedRef.current) return;
    widgetSavedRef.current = true;
    const daily = getDailyQuote(quotes);
    if (!daily) return;
    saveQuoteForWidget(daily.text, daily.author, daily.category, daily.id, currentStreak, isPremium);
    // Seed the widget refresh buffer with 5 random quotes for free users so
    // the refresh button cycles through varied content rather than staying stuck.
    if (!isPremium && quotes.length > 1) {
      const others = quotes.filter((q) => q.id !== daily.id);
      const seed: WidgetQuoteData[] = [
        { id: daily.id, text: daily.text, author: daily.author, category: daily.category, updatedAt: Date.now() },
        ...[...others].sort(() => Math.random() - 0.5).slice(0, 4).map((q) => ({
          id: q.id, text: q.text, author: q.author, category: q.category, updatedAt: Date.now(),
        })),
      ];
      saveQuotesBufferForWidget(seed).catch(() => {});
    }
  }, [quotes.length]);

  // When streak loads from Firestore after login, update the widget streak value
  useEffect(() => {
    if (currentStreak > 0) saveStreakForWidget(currentStreak).catch(() => {});
  }, [currentStreak]);

  // When language changes, reset the widget save flag so new-language quotes
  // get pushed to the widget on next quote load
  useEffect(() => {
    widgetSavedRef.current = false;
  }, [language]);

  // When streak loads from Firestore (after login), update the widget streak value
  useEffect(() => {
    if (currentStreak > 0) saveStreakForWidget(currentStreak).catch(() => {});
  }, [currentStreak]);

  // When language changes, reset the widget save flag so the new-language
  // quote gets persisted on the next quote load
  useEffect(() => {
    widgetSavedRef.current = false;
  }, [language]);

  // Helper: scroll to a quote by ID, prepending it to the list if not found.
  const scrollToQuoteById = useCallback(async (id: string): Promise<boolean> => {
    const idx = displayedQuotesRef.current.findIndex((q) => q.id === id);
    if (idx >= 0) {
      // Skip scroll if the user is already viewing this quote
      if (idx !== activeQuoteIndexRef.current) {
        flatListRef.current?.scrollToIndex({ index: idx, animated: false });
      }
      return true;
    }
    // Quote not in displayedQuotes (e.g. different category filter) —
    // find it in the full quote store and prepend it so it appears at index 0.
    const allQuotes = useQuoteStore.getState().quotes;
    const fullMatch = allQuotes.find((q) => q.id === id);
    if (fullMatch) {
      const { setQuotes } = useQuoteStore.getState();
      setQuotes([fullMatch, ...allQuotes.filter((q) => q.id !== id)]);
      setTimeout(() => flatListRef.current?.scrollToIndex({ index: 0, animated: false }), 100);
      return true;
    }
    // Quote not in current session — look up from the full raw source pool
    const fromSource = await findQuoteById(id);
    if (fromSource) {
      const { setQuotes } = useQuoteStore.getState();
      const current = useQuoteStore.getState().quotes;
      setQuotes([fromSource, ...current]);
      setTimeout(() => flatListRef.current?.scrollToIndex({ index: 0, animated: false }), 100);
      return true;
    }
    return false;
  }, []);

  // Handle deep links from widget tap: com.jiwonjae.dailyglow://quote?id=<id>
  // The app/quote.tsx route stores the id in AsyncStorage and redirects here.
  useEffect(() => {
    const storeId = (id: string) => {
      pendingQuoteIdRef.current = id;
    };
    const navigate = (url: string) => {
      const match = url.match(/[?&]id=([^&]+)/);
      if (!match) return;
      storeId(decodeURIComponent(match[1]));
    };
    // Check for a quote ID stored by app/quote.tsx (widget deep link)
    AsyncStorage.getItem('@dailyglow_pending_quote_id').then((storedId) => {
      if (storedId) {
        AsyncStorage.removeItem('@dailyglow_pending_quote_id').catch(() => {});
        storeId(storedId);
      }
    });
    Linking.getInitialURL().then((url) => { if (url) navigate(url); });
    const sub = Linking.addEventListener('url', ({ url }) => navigate(url));
    return () => sub.remove();
  }, []);

  // Once quotes are loaded, scroll to any pending deep-link quote.
  // Only act when loading is complete to avoid partial scrolls that get wiped.
  useEffect(() => {
    const id = pendingQuoteIdRef.current;
    if (!id || displayedQuotes.length === 0 || isLoading) return;
    scrollToQuoteById(id).then((found) => {
      if (found) pendingQuoteIdRef.current = null;
    });
  }, [displayedQuotes.length, isLoading]);

  // React to deep link quote ID set via Zustand store (works on warm starts
  // when the home screen is already mounted and the mount-only effect won't re-run)
  const pendingDeepLinkQuoteId = useQuoteStore((s) => s.pendingDeepLinkQuoteId);
  useEffect(() => {
    if (!pendingDeepLinkQuoteId) return;
    useQuoteStore.getState().setPendingDeepLinkQuoteId(null);
    pendingQuoteIdRef.current = pendingDeepLinkQuoteId;
    // On warm start, quotes are already loaded — scroll immediately
    if (displayedQuotes.length > 0 && !isLoading) {
      scrollToQuoteById(pendingDeepLinkQuoteId).then((found) => {
        if (found) pendingQuoteIdRef.current = null;
      });
    }
  }, [pendingDeepLinkQuoteId]);

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
    initCommunityStore();
  }, []);

  useEffect(() => {
    if (showCommunityQuotes && communityQuotes.length === 0) {
      loadCommunityQuotes(language, uid ?? undefined, true);
    }
  }, [showCommunityQuotes]);

  const autoPlayIndexRef = useRef(0);

  const prefetchMore = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try { appendQuotes(await fetchQuoteBatch()); }
    finally { setIsGenerating(false); }
  }, [isGenerating]);

  const advanceAndSpeakNext = useCallback(() => {
    if (!autoPlayChainRef.current || !useAutoPlayStore.getState().isAutoPlaying) return;
    const qs = useQuoteStore.getState().quotes;
    const nextIdx = autoPlayIndexRef.current + 1;
    if (nextIdx < qs.length) {
      // Only advance the ref when the index is in bounds
      autoPlayIndexRef.current = nextIdx;
      setActiveQuoteIndex(nextIdx);
      isProgrammaticScrollRef.current = true;
      flatListRef.current?.scrollToIndex({ index: nextIdx, animated: true });
      const nextQuote = qs[nextIdx];
      if (nextQuote) {
        speak(nextQuote.text, { onDone: advanceAndSpeakNext });
      }
    } else {
      // Don't advance the ref — leave it at the last valid index so that
      // once prefetchMore appends new quotes the next callback resumes correctly.
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
    if (showCommunityQuotes) loadCommunityQuotes(language, uid ?? undefined, true);
  }, [language]);

  useEffect(() => {
    if (quotes.length === 0 && !isLoading) {
      loadQuotes();
    }
  }, [selectedCategories, quotes.length, isLoading]);

  const loadQuotes = async () => {
    setIsLoading(true);
    try {
      const loaded = await getInitialQuotes();
      appLog.log('[home] quotes loaded', { count: loaded.length });

      // If a deep-link quote ID is pending, ensure it appears at index 0.
      const deepLinkId = pendingQuoteIdRef.current;
      if (deepLinkId) {
        pendingQuoteIdRef.current = null; // always clear to prevent double-handling
        const existingIdx = loaded.findIndex((q) => q.id === deepLinkId);
        if (existingIdx >= 0) {
          // Already in the batch — move to front
          const [target] = loaded.splice(existingIdx, 1);
          loaded.unshift(target);
          appLog.log('[home] deep-link quote moved to front', { id: deepLinkId });
        } else {
          const deepQuote = await findQuoteById(deepLinkId);
          if (deepQuote) {
            loaded.unshift(deepQuote);
            appLog.log('[home] deep-link quote prepended', { id: deepLinkId });
          }
        }
      }

      setQuotes(loaded);
      setIsOffline(false);
    } catch (err) {
      appLog.warn('[home] offline – failed to load quotes', { err: String(err) });
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Show daily quote modal once per day when quotes are first loaded.
  // Defer it until any queued modals (badge/praise/consent) have been dismissed
  // so two modals never overlap.
  const pendingPraise = useUserStore((s) => s.pendingPraise);
  const pendingNewUserSignIn_home = useUserStore((s) => s.pendingNewUserSignIn);
  useEffect(() => {
    if (quotes.length === 0 || dailyModalShownRef.current) return;
    // Wait for any queue-managed modals to finish before showing
    if (newBadgeEarned || pendingPraise || pendingNewUserSignIn_home) return;
    const today = todayString();
    AsyncStorage.getItem('dailyModalDate').then((stored) => {
      if (stored !== today && !dailyModalShownRef.current) {
        dailyModalShownRef.current = true;
        // Record the daily quote as viewed immediately on modal open
        const dailyQuote = getDailyQuote(quotes);
        if (dailyQuote) {
          addViewedQuote(dailyQuote.id, dailyQuote.text, dailyQuote.author, dailyQuote.source ?? '', today);
        }
        AsyncStorage.setItem('dailyModalDate', today);
        setShowDailyModal(true);
      }
    });
  }, [quotes.length, newBadgeEarned, pendingPraise, pendingNewUserSignIn_home]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const idx = viewableItems[0].index ?? 0;
        if (idx > lastViewedIndex.current) {
          incrementScroll().then((count) => tryShowAd(count));
        }
        lastViewedIndex.current = idx;
        setActiveQuoteIndex(idx);
        activeQuoteIndexRef.current = idx;
        const qs = displayedQuotesRef.current;
        const q = qs[idx];
        if (q) {
          if (isPremium) {
            saveQuoteForWidget(q.text, q.author, q.category, q.id, currentStreak, true);
          }
          if (viewableItems.length === 1) {
            addViewedQuote(q.id, q.text, q.author ?? '', q.source ?? '', todayString());
            if (q.category) trackCategoryView(q.category);
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
      const qs = displayedQuotesRef.current;
      const q = qs[idx];
      if (q) {
        addViewedQuote(q.id, q.text, q.author ?? '', q.source ?? '', todayString());
      }
    },
    [addViewedQuote],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleActivitySuccess = async (type: 'speak' | 'write' | 'type') => {
    setActiveSheet(null);

    const currentQuote = quotes[activeQuoteIndex];

    if (!isGuest && currentQuote && uid) {
      await recordActivity(type, currentQuote.id, currentQuote.text);
      await updateStreak(todayString());
      saveStreakForWidget(useUserStore.getState().currentStreak);
      const activityType = type === 'speak' ? 'speak_along' : type === 'write' ? 'write_along' : 'type_along';
      logActivityCompletion(uid, activityType);
    }

    // Capture any badge earned during the activity (e.g. streak milestone) and
    // suppress it until after the praise modal is queued, so the praise always
    // appears before the badge in the modal queue.
    const earnedBadge = useUserStore.getState().newBadgeEarned;
    if (earnedBadge) useUserStore.getState().clearNewBadge();

    // Show praise AFTER the ad closes (or immediately if no ad plays).
    const showPraise = async () => {
      let praise: string;
      try { praise = await getPraise(); }
      catch { praise = t('praise.fallback'); }
      useUserStore.getState().setPendingPraise(praise);

      // Re-set the badge AFTER praise so the queue orders praise → badge
      if (earnedBadge) {
        useUserStore.setState({ newBadgeEarned: earnedBadge });
      }

      if (isGuest && !loginPromptShown.current) {
        loginPromptShown.current = true;
        setTimeout(() => setLoginPromptVisible(true), 2000);
      }
    };

    showAdForActivity(isPremium, () => { showPraise(); });
  };

  const activeQuote = displayedQuotes[activeQuoteIndex];

  const renderItem = useCallback(
    ({ item, index }: { item: Quote; index: number }) => (
      <QuoteCard
        quote={item}
        onSpeakAlong={() => { setActiveQuoteIndex(index); setActiveSheet('speak'); }}
        onWriteAlong={() => { setActiveQuoteIndex(index); setActiveSheet('write'); }}
        onTypeAlong={() => { setActiveQuoteIndex(index); setActiveSheet('type'); }}
        onSubmitterPress={(submitterId, submitterName, submitterPhotoURL) =>
          setProfileTarget({ uid: submitterId, name: submitterName, photoURL: submitterPhotoURL })
        }
      />
    ),
    [],
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
      {isOffline && <OfflineBanner onDismiss={() => setIsOffline(false)} />}
      <FlatList
        ref={flatListRef}
        data={displayedQuotes}
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
        onEndReached={() => {
          if (showCommunityQuotes && communityHasMore) loadMoreCommunity(language, uid ?? undefined);
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={(isGenerating || (showCommunityQuotes && communityLoading)) ? <View style={styles.footer}><ActivityIndicator size="small" color={colors.primary} /></View> : null}
        ListEmptyComponent={!isLoading ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="book-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('home.searchEmpty')}</Text>
            <Pressable onPress={loadQuotes} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
              <Text style={styles.retryBtnText}>{t('common.ok')}</Text>
            </Pressable>
          </View>
        ) : null}
      />
      {activeQuote && (
        <>
          <SpeakAlongSheet visible={activeSheet === 'speak'} quoteText={activeQuote.text} onClose={() => setActiveSheet(null)} onSuccess={() => handleActivitySuccess('speak')} />
          <WriteAlongSheet visible={activeSheet === 'write'} quoteText={activeQuote.text} onClose={() => setActiveSheet(null)} onSuccess={() => handleActivitySuccess('write')} />
          <TypeAlongSheet visible={activeSheet === 'type'} quoteText={activeQuote.text} onClose={() => setActiveSheet(null)} onSuccess={() => handleActivitySuccess('type')} />
        </>
      )}
      {/* Daily quote modal – shown once per day on first open */}
      <DailyQuoteModal
        visible={showDailyModal}
        quotes={quotes}
        onClose={() => setShowDailyModal(false)}
        onViewCard={(q) => {
          const idx = quotes.findIndex((x) => x.id === q.id);
          if (idx >= 0) flatListRef.current?.scrollToIndex({ index: idx, animated: true });
          setShowDailyModal(false);
        }}
      />
      {/* Floating search button */}
      <Pressable
        style={[styles.searchBtn, { backgroundColor: colors.surface, top: insets.top + 8 }]}
        onPress={() => {
          appLog.log('[home] search modal opened');
          setSearchVisible(true);
          // Lazily build the full search corpus so author lookups work across all quotes
          getAllQuotesForSearch().then(setSearchPool).catch(() => {});
        }}
      >
        <Ionicons name="search-outline" size={22} color={colors.textPrimary} />
      </Pressable>

      {/* FAB: Submit a quote (logged-in users only) */}
      {!isGuest && (
        <Pressable
          style={[styles.fab, { backgroundColor: colors.primary, bottom: 65 + Math.max(20, insets.bottom) + 4 }]}
          onPress={() => setSubmitVisible(true)}
        >
          <Image source={PENCIL_ICON} style={{ width: 26, height: 26, tintColor: '#fff' }} resizeMode="contain" />
        </Pressable>
      )}

      <SubmitQuoteSheet visible={submitVisible} onClose={() => setSubmitVisible(false)} />

      {profileTarget && (
        <UserProfileModal
          visible={!!profileTarget}
          onClose={() => setProfileTarget(null)}
          targetUid={profileTarget.uid}
          targetName={profileTarget.name}
          targetPhotoURL={profileTarget.photoURL}
        />
      )}

      <QuoteSearchModal
        visible={searchVisible}
        quotes={searchPool.length > 0 ? searchPool : quotes}
        onClose={() => { appLog.log('[home] search modal closed'); setSearchVisible(false); }}
        onSelect={(q) => {
          setSearchVisible(false);
          const idx = quotes.findIndex((x) => x.id === q.id);
          appLog.log('[home] search quote selected', { id: q.id, idx });
          if (idx >= 0) {
            flatListRef.current?.scrollToIndex({ index: idx, animated: true });
          } else {
            // Quote is in search pool but not yet in the FlatList batch —
            // prepend it so it appears at position 0 and scroll there.
            setQuotes([q, ...quotes]);
            setTimeout(() => flatListRef.current?.scrollToIndex({ index: 0, animated: true }), 50);
          }
        }}
        onUserSelect={(user) => {
          setSearchVisible(false);
          setProfileTarget({ uid: user.uid, name: user.displayName ?? '', photoURL: user.photoURL });
        }}
      />
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
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  emptyText: { ...Fonts.body, fontSize: FontSize.md, textAlign: 'center' },
  retryBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: 20 },
  retryBtnText: { ...Fonts.heading, fontSize: FontSize.sm, color: '#fff' },
  searchBtn: {
    position: 'absolute',
    top: 14,
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
