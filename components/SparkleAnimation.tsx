import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';

const SPARKLE_SOURCE = require('../assets/sparkle-elem-icon.png');

const CONTAINER_W = 160;
const CONTAINER_H = 100;

/** Random integer in [lo, hi] inclusive */
function ri(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/** Returns a random spawn state: random size + random position inside container */
function randomSpawn(): { x: number; y: number; size: number } {
  const size = ri(10, 50);
  return {
    size,
    x: ri(0, Math.max(0, CONTAINER_W - size)),
    y: ri(0, Math.max(0, CONTAINER_H - size)),
  };
}

/**
 * A single sparkle particle.
 *
 * Lifecycle:
 *  - Born at a random position with a random size.
 *  - Has a fixed lifetime (randomly chosen per cycle).
 *  - Opacity curve (in parallel with movement — never blocking each other):
 *      0 → 1 during   0 … lifetime×¼   (fade in)
 *      1 → 1 during   lifetime×¼ … lifetime×¾  (hold)
 *      1 → 0 during   lifetime×¾ … lifetime     (fade out)
 *  - Movement: drifts upward across the full lifetime (parallel to opacity).
 *  - When lifetime ends, respawns at a new random position/size.
 */
function SingleSparkle({ initDelay, tintColor }: { initDelay: number; tintColor: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const mounted = useRef(true);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [spawn, setSpawn] = useState(randomSpawn);

  const run = useCallback(() => {
    if (!mounted.current) return;

    // Reset to invisible & un-translated at current spawn position
    opacity.setValue(0);
    translateY.setValue(0);

    const lifetime = ri(2000, 3800);          // total lifespan in ms
    const drift    = ri(18, 48);              // upward pixel distance over lifetime
    const peak     = 0.85 + Math.random() * 0.1; // slight peak opacity variation

    // ── Opacity: three phases in sequence ──────────────────────────────────
    const opacityAnim = Animated.sequence([
      Animated.timing(opacity, {
        toValue: peak,
        duration: lifetime * 0.25,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: peak,
        duration: lifetime * 0.50,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: lifetime * 0.25,
        useNativeDriver: true,
      }),
    ]);

    // ── Movement: upward drift over the full lifetime (runs in parallel) ───
    const moveAnim = Animated.timing(translateY, {
      toValue: -drift,
      duration: lifetime,
      useNativeDriver: true,
    });

    // ── Start both simultaneously ───────────────────────────────────────────
    const anim = Animated.parallel([opacityAnim, moveAnim]);
    animRef.current = anim;

    anim.start(({ finished }) => {
      if (finished && mounted.current) {
        // Opacity is already 0; reset translateY before re-render so there's
        // no visible jump when the new spawn position is applied.
        translateY.setValue(0);
        setSpawn(randomSpawn());
        timerRef.current = setTimeout(run, ri(40, 160));
      }
    });
  }, []);

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

/** Six sparkles with staggered initial delays for a lively, continuous feel. */
export default function SparkleAnimation() {
  const colors = useThemeColors();
  return (
    <View style={styles.container}>
      <SingleSparkle initDelay={0}    tintColor={colors.primary} />
      <SingleSparkle initDelay={280}  tintColor={colors.primary} />
      <SingleSparkle initDelay={620}  tintColor={colors.primary} />
      <SingleSparkle initDelay={1050} tintColor={colors.primary} />
      <SingleSparkle initDelay={1480} tintColor={colors.primary} />
      <SingleSparkle initDelay={1900} tintColor={colors.primary} />
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
