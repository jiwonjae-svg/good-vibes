import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Pressable,
  ViewToken,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { FontSize, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { CATEGORY_THEMES } from '../data/categories';
import { useUserStore } from '../stores/useUserStore';
import { requestNotificationPermission, scheduleDailyReminder } from '../services/notificationService';
import { appLog } from '../services/logger';

const { width, height } = Dimensions.get('window');

const SLIDES_DATA = [
  { key: '1', emoji: '✨', titleKey: 'onboarding.slide1Title', descKey: 'onboarding.slide1Desc', gradient: ['#FFE5D9', '#FFD4C2'] },
  { key: '2', emoji: '🎤', titleKey: 'onboarding.slide2Title', descKey: 'onboarding.slide2Desc', gradient: ['#D4E8FF', '#C5E8F7'] },
  { key: '3', emoji: '🌱', titleKey: 'onboarding.slide3Title', descKey: 'onboarding.slide3Desc', gradient: ['#D4FFE8', '#C2FFD4'] },
  { key: '4', emoji: '🚀', titleKey: 'onboarding.slide4Title', descKey: 'onboarding.slide4Desc', gradient: ['#FFF3D4', '#FFE8A3'] },
] as const;

// Collect a manageable set of category keys for the onboarding picker (first 3 themes)
const ONBOARDING_CATEGORIES = CATEGORY_THEMES.slice(0, 3).flatMap((theme) =>
  theme.categories.slice(0, 8),
);

const TOTAL_STEPS_FULL = SLIDES_DATA.length + 2; // 4 slides + category + notification
const TOTAL_STEPS_REPLAY = SLIDES_DATA.length; // 4 slides only (replay mode)

interface OnboardingScreenProps {
  onComplete: () => void;
  isReplay?: boolean;
}

export default function OnboardingScreen({ onComplete, isReplay = false }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [slideIndex, setSlideIndex] = useState(0);
  const [step, setStep] = useState(0); // 0-3: slides, 4: categories, 5: notification
  const flatListRef = useRef<FlatList>(null);
  const setCategories = useUserStore((s) => s.setCategories);
  const setDailyReminder = useUserStore((s) => s.setDailyReminder);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const idx = viewableItems[0].index ?? 0;
        setSlideIndex(idx);
        setStep(idx);
      }
    }
  ).current;

  const toggleCategory = (key: string) => {
    setSelectedCats((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      appLog.log('[onboarding] category toggled', { key, selected: !prev.includes(key), total: next.length });
      return next;
    });
  };

  const TOTAL_STEPS = isReplay ? TOTAL_STEPS_REPLAY : TOTAL_STEPS_FULL;

  const goNext = async () => {
    if (step < SLIDES_DATA.length - 1) {
      // Advance within FlatList slides
      flatListRef.current?.scrollToIndex({ index: step + 1, animated: true });
    } else if (step === SLIDES_DATA.length - 1) {
      if (isReplay) {
        // Replay mode: skip category / notification steps
        appLog.log('[onboarding] replay completed');
        onComplete();
        return;
      }
      // Leave FlatList, go to category step
      setStep(SLIDES_DATA.length);
    } else if (step === SLIDES_DATA.length) {
      // Save selected categories and advance to notification step
      if (selectedCats.length > 0) {
        appLog.log('[onboarding] categories saved', { categories: selectedCats });
        await setCategories(selectedCats);
      }
      setStep(SLIDES_DATA.length + 1);
    } else {
      // Notification step — user pressed "Skip"
      appLog.log('[onboarding] notification skipped');
      onComplete();
    }
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    appLog.log('[onboarding] notification permission', { granted });
    if (granted) {
      await setDailyReminder(true);
      await scheduleDailyReminder();
    }
    appLog.log('[onboarding] completed');
    onComplete();
  };

  const currentStepForDots = step;

  const renderExtraStep = () => {
    if (step === SLIDES_DATA.length) {
      // Category picker
      return (
        <View style={[styles.extraStep, { backgroundColor: colors.background }]}>
          <Text style={styles.extraEmoji}>🎯</Text>
          <Text style={[styles.extraTitle, { color: colors.textPrimary }]}>
            {t('onboarding.categoryTitle')}
          </Text>
          <Text style={[styles.extraDesc, { color: colors.textSecondary }]}>
            {t('onboarding.categorySubtitle')}
          </Text>
          <ScrollView
            style={styles.catsScroll}
            contentContainerStyle={styles.catsContainer}
            showsVerticalScrollIndicator={false}
          >
            {ONBOARDING_CATEGORIES.map((cat) => {
              const selected = selectedCats.includes(cat.key);
              return (
                <Pressable
                  key={cat.key}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.surfaceAlt,
                      borderColor: selected ? colors.primary : 'transparent',
                    },
                  ]}
                  onPress={() => toggleCategory(cat.key)}
                >
                  <Text style={[styles.catChipText, { color: selected ? '#fff' : colors.textPrimary }]}>
                    {t(cat.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    if (step === SLIDES_DATA.length + 1) {
      // Notification step
      return (
        <View style={[styles.extraStep, { backgroundColor: colors.background }]}>
          <Text style={styles.extraEmoji}>🔔</Text>
          <Text style={[styles.extraTitle, { color: colors.textPrimary }]}>
            {t('onboarding.notifTitle')}
          </Text>
          <Text style={[styles.extraDesc, { color: colors.textSecondary }]}>
            {t('onboarding.notifSubtitle')}
          </Text>
          <Pressable
            style={[styles.notifButton, { backgroundColor: colors.primary }]}
            onPress={handleEnableNotifications}
          >
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            <Text style={styles.notifButtonText}>{t('onboarding.notifEnable')}</Text>
          </Pressable>
          <Pressable style={styles.notifSkipBtn} onPress={onComplete}>
            <Text style={[styles.notifSkipText, { color: colors.textMuted }]}>
              {t('onboarding.notifSkip')}
            </Text>
          </Pressable>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Pressable style={styles.skipButton} onPress={onComplete}>
        <Text style={[styles.skipText, { color: colors.textMuted }]}>{t('onboarding.skip')}</Text>
      </Pressable>

      {step < SLIDES_DATA.length ? (
        <FlatList
          ref={flatListRef}
          data={SLIDES_DATA}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
          renderItem={({ item }) => (
            <LinearGradient colors={item.gradient as unknown as [string, string]} style={styles.slide}>
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{t(item.titleKey)}</Text>
              <Text style={[styles.desc, { color: colors.textSecondary }]}>{t(item.descKey)}</Text>
            </LinearGradient>
          )}
          keyExtractor={(item) => item.key}
        />
      ) : (
        renderExtraStep()
      )}

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom + 8, Spacing.lg) }]}>
        <View style={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === currentStepForDots ? colors.primary : colors.textMuted },
              ]}
            />
          ))}
        </View>

        {step < SLIDES_DATA.length + 1 && (
          <Pressable style={[styles.nextButton, { backgroundColor: colors.primary }]} onPress={goNext}>
            <Text style={styles.nextText}>
              {step === SLIDES_DATA.length ? t('onboarding.next') : step === SLIDES_DATA.length - 1 ? t('onboarding.next') : t('onboarding.next')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipButton: { position: 'absolute', top: 56, right: 20, zIndex: 10, padding: Spacing.sm },
  skipText: { ...Fonts.body, fontSize: FontSize.md },
  slide: { width, height: height * 0.7, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  emoji: { fontSize: 80, marginBottom: Spacing.lg },
  title: { ...Fonts.heading, fontSize: FontSize.xl, textAlign: 'center', marginBottom: Spacing.md },
  desc: { ...Fonts.body, fontSize: FontSize.md, textAlign: 'center', lineHeight: 26 },
  bottom: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg },
  dots: { flexDirection: 'row', gap: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  nextButton: { paddingHorizontal: Spacing.xl + Spacing.md, paddingVertical: Spacing.md, borderRadius: BorderRadius.full },
  nextText: { ...Fonts.heading, fontSize: FontSize.md, color: '#fff' },
  // Extra steps
  extraStep: {
    flex: 1,
    height: height * 0.7,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraEmoji: { fontSize: 64, marginBottom: Spacing.md },
  extraTitle: { ...Fonts.heading, fontSize: FontSize.xl, textAlign: 'center', marginBottom: Spacing.sm },
  extraDesc: { ...Fonts.body, fontSize: FontSize.md, textAlign: 'center', lineHeight: 24, marginBottom: Spacing.lg },
  catsScroll: { width: '100%', maxHeight: height * 0.3 },
  catsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center', paddingBottom: Spacing.md },
  catChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  catChipText: { ...Fonts.body, fontSize: FontSize.sm, fontWeight: '500' },
  notifButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
  },
  notifButtonText: { ...Fonts.heading, fontSize: FontSize.md, color: '#fff' },
  notifSkipBtn: { marginTop: Spacing.md, padding: Spacing.sm },
  notifSkipText: { ...Fonts.body, fontSize: FontSize.md },
});
