import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';

const SPARKLE_SOURCE = require('../assets/sparkle-elem-icon.png');

const CONTAINER_W = 160;
const CONTAINER_H = 90;

/** Random integer in [lo, hi] inclusive */
function ri(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/**
 * Returns a pixel size for the given particle slot.
 * isLarge: 38–50 px
 * smallIndex 0: 20–26 px   (medium-small)
 * smallIndex 1: 14–19 px   (small)
 * smallIndex 2: 10–14 px   (tiny)
 */
function getSize(isLarge: boolean, si = 0): number {
  if (isLarge) return ri(38, 50);
  return [ri(20, 26), ri(14, 19), ri(10, 14)][si];
}

/** Returns a random {x, y} spawn position that keeps the particle inside the container */
function randomPos(sz: number): { x: number; y: number } {
  return {
    x: ri(0, Math.max(0, CONTAINER_W - sz)),
    y: ri(0, Math.max(0, CONTAINER_H - sz)),
  };
}

interface SparkleProps {
  isLarge: boolean;
  smallIndex?: number;
  initDelay: number;
  tintColor: string;
}

/**
 * A single sparkle particle.
 * Behaviour:
 *   1. Gradually appear while drifting upward.
 *   2. Continue upward while gradually disappearing.
 *   3. Once fully invisible, teleport to a new random position with a new
 *      random size, then wait a brief random pause before repeating.
 */
function SingleSparkle({ isLarge, smallIndex = 0, initDelay, tintColor }: SparkleProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const mounted = useRef(true);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [spawn, setSpawn] = useState(() => {
    const sz = getSize(isLarge, smallIndex);
    return { ...randomPos(sz), size: sz };
  });

  const run = useCallback(() => {
    if (!mounted.current) return;
    opacity.setValue(0);
    translateY.setValue(0);

    const drift = ri(28, 55);    // total upward distance
    const riseMs = ri(480, 880);  // appear + first half of travel
    const fadeMs = ri(450, 800);  // fade-out + second half of travel

    const a = Animated.sequence([
      // Phase 1: fade in while rising
      Animated.parallel([
        Animated.timing(opacity,     { toValue: 0.9,         duration: riseMs, useNativeDriver: true }),
        Animated.timing(translateY,  { toValue: -(drift * 0.5), duration: riseMs, useNativeDriver: true }),
      ]),
      // Phase 2: fade out while continuing to rise
      Animated.parallel([
        Animated.timing(opacity,     { toValue: 0,    duration: fadeMs, useNativeDriver: true }),
        Animated.timing(translateY,  { toValue: -drift, duration: fadeMs, useNativeDriver: true }),
      ]),
    ]);

    animRef.current = a;
    a.start(({ finished }) => {
      if (finished && mounted.current) {
        // Reset the Y offset synchronously BEFORE the React state update so the
        // particle doesn't briefly flash at an unexpected vertical position.
        translateY.setValue(0);
        const sz = getSize(isLarge, smallIndex);
        setSpawn({ ...randomPos(sz), size: sz });
        // Short pause before repeating — small enough to feel continuous.
        timerRef.current = setTimeout(run, ri(60, 200));
      }
    });
  }, [isLarge, smallIndex]);

  useEffect(() => {
    mounted.current = true;
    timerRef.current = setTimeout(run, initDelay);
    return () => {
      mounted.current = false;
      animRef.current?.stop();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [run, initDelay]);

  return (
    <Animated.Image
      source={SPARKLE_SOURCE}
      style={[
        styles.sparkle,
        {
          width: spawn.size,
          height: spawn.size,
          left: spawn.x,
          top: spawn.y,
          tintColor,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    />
  );
}

/** Four sparkles: 1 large + 3 progressively smaller, staggered start times. */
export default function SparkleAnimation() {
  const colors = useThemeColors();
  return (
    <View style={styles.container}>
      <SingleSparkle isLarge                  initDelay={0}    tintColor={colors.primary} />
      <SingleSparkle isLarge={false} smallIndex={0} initDelay={300}  tintColor={colors.primary} />
      <SingleSparkle isLarge={false} smallIndex={1} initDelay={680}  tintColor={colors.primary} />
      <SingleSparkle isLarge={false} smallIndex={2} initDelay={1080} tintColor={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CONTAINER_W,
    height: CONTAINER_H,
    position: 'relative',
  },
  sparkle: {
    position: 'absolute',
    resizeMode: 'contain',
  },
});
