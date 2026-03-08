import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Pressable,
  ViewToken,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../hooks/useThemeColors';
import { FontSize, Spacing, BorderRadius, Fonts } from '../constants/theme';

const { width, height } = Dimensions.get('window');

const SLIDES_DATA = [
  { key: '1', emoji: '✨', titleKey: 'onboarding.slide1Title', descKey: 'onboarding.slide1Desc', gradient: ['#FFE5D9', '#FFD4C2'] },
  { key: '2', emoji: '🎤', titleKey: 'onboarding.slide2Title', descKey: 'onboarding.slide2Desc', gradient: ['#D4E8FF', '#C5E8F7'] },
  { key: '3', emoji: '🌱', titleKey: 'onboarding.slide3Title', descKey: 'onboarding.slide3Desc', gradient: ['#D4FFE8', '#C2FFD4'] },
  { key: '4', emoji: '🚀', titleKey: 'onboarding.slide4Title', descKey: 'onboarding.slide4Desc', gradient: ['#FFF3D4', '#FFE8A3'] },
] as const;

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index ?? 0);
      }
    }
  ).current;

  const goNext = () => {
    if (currentIndex < SLIDES_DATA.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      onComplete();
    }
  };

  const isLast = currentIndex === SLIDES_DATA.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Pressable style={styles.skipButton} onPress={onComplete}>
        <Text style={[styles.skipText, { color: colors.textMuted }]}>{t('onboarding.skip')}</Text>
      </Pressable>

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

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom + 8, Spacing.lg) }]}>
        <View style={styles.dots}>
          {SLIDES_DATA.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i === currentIndex ? colors.primary : colors.textMuted }]}
            />
          ))}
        </View>

        <Pressable style={[styles.nextButton, { backgroundColor: colors.primary }]} onPress={goNext}>
          <Text style={styles.nextText}>{isLast ? t('onboarding.start') : t('onboarding.next')}</Text>
        </Pressable>
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
});
