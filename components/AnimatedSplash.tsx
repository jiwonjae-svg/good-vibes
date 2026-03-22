/**
 * AnimatedSplash — Daily Glow
 *
 * Sequence:
 *  1. 흰 배경
 *  2. 큰따옴표(앞) fade-in + spring scale
 *  3. 종이 흔들기 (pivot-at-base jiggle, like OnboardingScreen sprout)
 *  4. 주황색 파문 4개 동심원 확장 (theme primary)
 *  5. "Daily Glow" 로고 텍스트 슬라이드업 + fade-in
 *  6. onAnimationComplete
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing, Text } from 'react-native';
import { LightColors, FontSize } from '../constants/theme';

const { width } = Dimensions.get('window');

// Opening double-quote mark (앞쪽 큰따옴표)
const QUOTE_ICON = require('../assets/double quotes-front.png');

// Ripple uses theme primary orange
const RIPPLE_COLOR = LightColors.primary; // #FF9F7E
const RIPPLE_BASE = width * 0.5;

const ICON_SIZE = 120;

interface AnimatedSplashProps {
  onAnimationComplete: () => void;
}

export default function AnimatedSplash({ onAnimationComplete }: AnimatedSplashProps) {
  // ── Quote mark ──────────────────────────────────────────────────
  const quoteOpacity = useRef(new Animated.Value(0)).current;
  const quoteScale   = useRef(new Animated.Value(0.6)).current;
  const quoteSway    = useRef(new Animated.Value(0)).current;

  // ── Ripple rings (4×) ───────────────────────────────────────────
  const r = [0, 1, 2, 3].map(() => ({
    scale:   useRef(new Animated.Value(0.15)).current,
    opacity: useRef(new Animated.Value(0)).current,
  }));

  // ── Logo / app name ────────────────────────────────────────────
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoY       = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    // ─ Step 1: quote appears (0 → ~500ms) ─────────────────────────
    Animated.parallel([
      Animated.timing(quoteOpacity, {
        toValue: 1, duration: 450, useNativeDriver: true,
      }),
      Animated.spring(quoteScale, {
        toValue: 1, friction: 5, tension: 75, useNativeDriver: true,
      }),
    ]).start(() => {

      // ─ Step 2: paper jiggle (~500ms → 1100ms) ──────────────────
      quoteSway.setValue(0);
      Animated.sequence([
        Animated.delay(100),
        Animated.timing(quoteSway, { toValue:  1,    duration: 80,  useNativeDriver: true }),
        Animated.timing(quoteSway, { toValue: -0.75, duration: 100, useNativeDriver: true }),
        Animated.timing(quoteSway, { toValue:  0.55, duration: 90,  useNativeDriver: true }),
        Animated.timing(quoteSway, { toValue: -0.35, duration: 80,  useNativeDriver: true }),
        Animated.timing(quoteSway, { toValue:  0.2,  duration: 70,  useNativeDriver: true }),
        Animated.timing(quoteSway, { toValue: -0.1,  duration: 60,  useNativeDriver: true }),
        Animated.timing(quoteSway, { toValue:  0,    duration: 50,  useNativeDriver: true }),
      ]).start(() => {

        // ─ Step 3: 파문 (ripple, 4 staggered rings) ──────────────
        Animated.stagger(170, r.map(({ scale, opacity }) =>
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 2.6,
              duration: 900,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(opacity, { toValue: 0.6,  duration: 160, useNativeDriver: true }),
              Animated.timing(opacity, { toValue: 0,    duration: 740, useNativeDriver: true }),
            ]),
          ]),
        )).start();

        // ─ Step 4: logo slides up 300ms after ripple starts ───────
        Animated.sequence([
          Animated.delay(320),
          Animated.parallel([
            Animated.timing(logoOpacity, {
              toValue: 1, duration: 550, useNativeDriver: true,
            }),
            Animated.timing(logoY, {
              toValue: 0, duration: 550,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]).start();

        // ─ Done ───────────────────────────────────────────────────
        const done = setTimeout(onAnimationComplete, 1700);
        return () => clearTimeout(done);
      });
    });
  }, [onAnimationComplete]);

  const quoteRotate = quoteSway.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-14deg', '0deg', '14deg'],
  });

  return (
    <View style={styles.container}>

      {/* ── Ripple rings (centered, behind icon) ── */}
      {r.map(({ scale, opacity }, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ripple,
            {
              borderColor: RIPPLE_COLOR,
              borderWidth: 2.5 - i * 0.4,
              opacity,
              transform: [{ scale }],
            },
          ]}
        />
      ))}

      {/* ── Center column: icon + app name ── */}
      <View style={styles.centerCol}>

        {/* Quote mark — pivot at base (bottom-center) for paper-jiggle */}
        <Animated.Image
          source={QUOTE_ICON}
          style={[
            styles.quoteIcon,
            {
              opacity: quoteOpacity,
              tintColor: LightColors.primary,
              transform: [
                { translateY: ICON_SIZE / 2 },
                { rotate: quoteRotate },
                { translateY: -(ICON_SIZE / 2) },
                { scale: quoteScale },
              ],
            },
          ]}
          resizeMode="contain"
        />

        {/* App name */}
        <Animated.View
          style={[
            styles.logoWrapper,
            { opacity: logoOpacity, transform: [{ translateY: logoY }] },
          ]}
        >
          <Text style={styles.appName}>Daily Glow</Text>
        </Animated.View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: RIPPLE_BASE,
    height: RIPPLE_BASE,
    borderRadius: RIPPLE_BASE / 2,
  },
  centerCol: {
    alignItems: 'center',
    gap: 20,
  },
  quoteIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  logoWrapper: {
    alignItems: 'center',
  },
  appName: {
    fontSize: FontSize.xxl,    // 32
    fontWeight: '700',
    color: LightColors.primary,
    letterSpacing: 0.5,
  },
});
