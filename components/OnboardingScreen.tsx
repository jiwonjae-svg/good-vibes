import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Pressable,
  ViewToken,
  ScrollView,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { FontSize, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { CATEGORY_THEMES } from '../data/categories';
import { useUserStore } from '../stores/useUserStore';
import { requestNotificationPermission, scheduleSmartNotifications } from '../services/notificationService';
import { appLog } from '../services/logger';
import SparkleAnimation from './SparkleAnimation';

const MIC_ICON = require('../assets/mic-elem-icon.png');
const SPROUT_ICON = require('../assets/sprout-elem-icon.png');
const ROCKET_ICON = require('../assets/rocket-elem-icon.png');
const BELL_ICON = require('../assets/bell-elem-icon.png');
const TARGET_ICON = require('../assets/target-elem-icon.png');

// ─── Animated slide icons ────────────────────────────────────────────────────

/** Slide 2: mic with subtle pulse */
function AnimatedMicIcon({ tintColor }: { tintColor: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.Image
      source={MIC_ICON}
      style={{ width: 90, height: 90, tintColor, transform: [{ scale: pulse }], marginBottom: Spacing.lg }}
      resizeMode="contain"
    />
  );
}

/** Slide 3: sprout pudding-jiggle — spring oscillation tapering to rest, pivoting at base */
function AnimatedSproutIcon({ tintColor }: { tintColor: string }) {
  const sway = useRef(new Animated.Value(0)).current;
  const SIZE = 90;

  const jiggleCycle = useCallback(() => {
    sway.setValue(0);
    Animated.sequence([
      Animated.delay(2200),
      // Nudge and spring-jiggle like a pudding being tapped
      Animated.timing(sway, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(sway, { toValue: -0.75, duration: 100, useNativeDriver: true }),
      Animated.timing(sway, { toValue: 0.55, duration: 90, useNativeDriver: true }),
      Animated.timing(sway, { toValue: -0.35, duration: 80, useNativeDriver: true }),
      Animated.timing(sway, { toValue: 0.2, duration: 70, useNativeDriver: true }),
      Animated.timing(sway, { toValue: -0.1, duration: 60, useNativeDriver: true }),
      Animated.timing(sway, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) jiggleCycle(); });
  }, []);

  useEffect(() => {
    jiggleCycle();
    return () => sway.stopAnimation();
  }, [jiggleCycle]);

  const rotate = sway.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-14deg', '0deg', '14deg'] });
  // Pivot at bottom-center: translateY down by half → rotate → translateY back
  return (
    <Animated.Image
      source={SPROUT_ICON}
      style={{
        width: SIZE,
        height: SIZE,
        tintColor,
        marginBottom: Spacing.lg,
        transform: [
          { translateY: SIZE / 2 },
          { rotate },
          { translateY: -(SIZE / 2) },
        ],
      }}
      resizeMode="contain"
    />
  );
}

/** Slide 4: rocket launches at 45° (upper-right), fades out, snaps back, fades in, repeat */
function AnimatedRocketIcon({ tintColor }: { tintColor: string }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const launchCycle = useCallback(() => {
    translateX.setValue(0);
    translateY.setValue(0);
    opacity.setValue(1);
    Animated.sequence([
      Animated.delay(1600),
      Animated.parallel([
        Animated.timing(translateX, { toValue: 80, duration: 580, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -80, duration: 580, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 460, useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => {
      if (finished) {
        translateX.setValue(0);
        translateY.setValue(0);
        Animated.timing(opacity, { toValue: 1, duration: 380, useNativeDriver: true }).start(({ finished: f }) => {
          if (f) launchCycle();
        });
      }
    });
  }, []);

  useEffect(() => {
    launchCycle();
    return () => { translateX.stopAnimation(); translateY.stopAnimation(); opacity.stopAnimation(); };
  }, [launchCycle]);

  return (
    <Animated.Image
      source={ROCKET_ICON}
      style={{ width: 90, height: 90, tintColor, transform: [{ translateX }, { translateY }], opacity, marginBottom: Spacing.lg }}
      resizeMode="contain"
    />
  );
}

/** Extra step: bell with ringing animation */
function AnimatedBellIcon({ tintColor }: { tintColor: string }) {
  const ring = useRef(new Animated.Value(0)).current;

  const ringCycle = useCallback(() => {
    ring.setValue(0);
    Animated.sequence([
      Animated.delay(800),
      Animated.sequence([
        Animated.timing(ring, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(ring, { toValue: -1, duration: 90, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(ring, { toValue: -1, duration: 90, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 0.6, duration: 90, useNativeDriver: true }),
        Animated.timing(ring, { toValue: -0.6, duration: 90, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 0, duration: 90, useNativeDriver: true }),
      ]),
      Animated.delay(600),
    ]).start(({ finished }) => { if (finished) ringCycle(); });
  }, []);

  useEffect(() => {
    ringCycle();
    return () => ring.stopAnimation();
  }, [ringCycle]);

  const rotate = ring.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-20deg', '0deg', '20deg'] });

  return (
    <Animated.Image
      source={BELL_ICON}
      style={{ width: 90, height: 90, tintColor, transform: [{ rotate }], marginBottom: Spacing.lg }}
      resizeMode="contain"
    />
  );
}

/** Extra step: target with pulse animation */
function AnimatedTargetIcon({ tintColor }: { tintColor: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.Image
      source={TARGET_ICON}
      style={{ width: 90, height: 90, tintColor, transform: [{ scale: pulse }], marginBottom: Spacing.lg }}
      resizeMode="contain"
    />
  );
}

/** Dispatches the appropriate icon component per slide */
function SlideIcon({ slideKey, tintColor }: { slideKey: string; tintColor: string }) {
  if (slideKey === '1') {
    return (
      <View style={{ height: 90, width: 160, marginBottom: Spacing.lg }}>
        <SparkleAnimation />
      </View>
    );
  }
  if (slideKey === '2') return <AnimatedMicIcon tintColor={tintColor} />;
  if (slideKey === '3') return <AnimatedSproutIcon tintColor="#40C463" />;
  if (slideKey === '4') return <AnimatedRocketIcon tintColor={tintColor} />;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

const { width, height } = Dimensions.get('window');

const SLIDES_DATA = [
  { key: '1', emoji: '✨', titleKey: 'onboarding.slide1Title', descKey: 'onboarding.slide1Desc', gradient: ['#FFE5D9', '#FFD4C2'] },
  { key: '2', emoji: '🎤', titleKey: 'onboarding.slide2Title', descKey: 'onboarding.slide2Desc', gradient: ['#D4E8FF', '#C5E8F7'] },
  { key: '3', emoji: '🌱', titleKey: 'onboarding.slide3Title', descKey: 'onboarding.slide3Desc', gradient: ['#D4FFE8', '#C2FFD4'] },
  { key: '4', emoji: '🚀', titleKey: 'onboarding.slide4Title', descKey: 'onboarding.slide4Desc', gradient: ['#FFF3D4', '#FFE8A3'] },
] as const;

// All categories are shown in the onboarding picker, grouped by theme
// (no subset restriction — user should see everything upfront)

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
  // Phase fade animation: fades out slides, then fades in setup steps
  const phaseAnim = useRef(new Animated.Value(1)).current;

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

  const isSetupPhase = step >= SLIDES_DATA.length;
  // Dots: 4 in slide phase, 2 in setup phase
  const dotsCount = isSetupPhase ? 2 : SLIDES_DATA.length;
  const activeDotsIndex = isSetupPhase ? step - SLIDES_DATA.length : step;

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
      // Fade out slides, switch to setup phase, fade back in
      Animated.timing(phaseAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => {
        setStep(SLIDES_DATA.length);
        Animated.timing(phaseAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
      });
      return;
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
      await scheduleSmartNotifications({ dailyReminderEnabled: true });
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
          <AnimatedTargetIcon tintColor={colors.primary} />
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
            {CATEGORY_THEMES.map((theme) => (
              <View key={theme.themeKey}>
                <Text style={[styles.themeHeader, { color: colors.textMuted }]}>
                  {t(theme.themeKey)}
                </Text>
                <View style={styles.chipsRow}>
                  {theme.categories.map((cat) => {
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
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }

    if (step === SLIDES_DATA.length + 1) {
      // Notification step
      return (
        <View style={[styles.extraStep, { backgroundColor: colors.background }]}>
          <AnimatedBellIcon tintColor={colors.primary} />
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
        <Animated.View style={{ opacity: phaseAnim }}>
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
                <SlideIcon slideKey={item.key} tintColor={colors.primary} />
                <Text style={[styles.title, { color: colors.textPrimary }]}>{t(item.titleKey)}</Text>
                <Text style={[styles.desc, { color: colors.textSecondary }]}>{t(item.descKey)}</Text>
              </LinearGradient>
            )}
            keyExtractor={(item) => item.key}
          />
        </Animated.View>
      ) : (
        <Animated.View style={{ opacity: phaseAnim, flex: 1 }}>
          {renderExtraStep()}
        </Animated.View>
      )}

      <Animated.View
        style={[
          styles.bottom,
          { paddingBottom: Math.max(insets.bottom + 8, Spacing.lg), opacity: phaseAnim },
          !isSetupPhase && { flex: 1 },
        ]}
      >
        <View style={styles.dots}>
          {Array.from({ length: dotsCount }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === activeDotsIndex ? colors.primary : colors.textMuted },
              ]}
            />
          ))}
        </View>

        {step < SLIDES_DATA.length + 1 && (
          <Pressable style={[styles.nextButton, { backgroundColor: colors.primary }]} onPress={goNext}>
            <Text style={styles.nextText}>{t('onboarding.next')}</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipButton: { position: 'absolute', top: 56, right: 20, zIndex: 10, padding: Spacing.sm },
  skipText: { ...Fonts.body, fontSize: FontSize.md },
  slide: { width, height: height * 0.72, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  emoji: { fontSize: 80, marginBottom: Spacing.lg },
  title: { ...Fonts.heading, fontSize: FontSize.xl, textAlign: 'center', marginBottom: Spacing.md },
  desc: { ...Fonts.body, fontSize: FontSize.md, textAlign: 'center', lineHeight: 26 },
  bottom: { justifyContent: 'center', alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.md },
  dots: { flexDirection: 'row', gap: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  nextButton: { paddingHorizontal: Spacing.xl + Spacing.md, paddingVertical: Spacing.md, borderRadius: BorderRadius.full },
  nextText: { ...Fonts.heading, fontSize: FontSize.md, color: '#fff' },
  // Extra steps
  extraStep: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  extraEmoji: { fontSize: 64, marginBottom: Spacing.md },
  extraTitle: { ...Fonts.heading, fontSize: FontSize.xl, textAlign: 'center', marginBottom: Spacing.sm },
  extraDesc: { ...Fonts.body, fontSize: FontSize.md, textAlign: 'center', lineHeight: 24, marginBottom: Spacing.lg },
  catsScroll: { width: '100%', maxHeight: height * 0.44 },
  catsContainer: { paddingBottom: Spacing.md },
  themeHeader: { ...Fonts.body, fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: Spacing.md, marginBottom: Spacing.sm },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
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
