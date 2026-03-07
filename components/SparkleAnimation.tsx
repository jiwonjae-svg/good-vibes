import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';

const SPARKLE_SOURCE = require('../assets/sparkle-elem-icon.png');

interface SparkleProps {
  size: number;
  startLeft: number;
  startTop: number;
  driftX: number;
  driftY: number;
  delay: number;
  tintColor: string;
}

function SingleSparkle({ size, startLeft, startTop, driftX, driftY, delay, tintColor }: SparkleProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        // Reset position at start of each visible cycle
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.85, duration: 550, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: driftX * 0.6, duration: 550, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: driftY * 0.6, duration: 550, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 750, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: driftX, duration: 750, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: driftY, duration: 750, useNativeDriver: true }),
        ]),
        // Brief invisible pause before re-appearing
        Animated.delay(300),
      ]),
    );

    // Reset position values at the start so each loop begins from base
    const resetAndStart = () => {
      translateX.setValue(0);
      translateY.setValue(0);
      opacity.setValue(0);
      loop.start();
    };
    resetAndStart();

    return () => loop.stop();
  }, []);

  return (
    <Animated.Image
      source={SPARKLE_SOURCE}
      style={[
        styles.sparkle,
        {
          width: size,
          height: size,
          left: startLeft,
          top: startTop,
          tintColor,
          opacity,
          transform: [{ translateX }, { translateY }],
        },
      ]}
    />
  );
}

// Four sparkles: one large (index 0), three smaller — all clustered around
// a ~160×90 bounding box replacing the ✨ emoji header icon
const SPARKLE_CONFIG = [
  { size: 42, startLeft: 59, startTop: 16, driftX: -9,  driftY: -22, delay: 0    }, // large, top-center
  { size: 22, startLeft: 12, startTop: 38, driftX: -7,  driftY: -16, delay: 400  }, // medium-small, left
  { size: 20, startLeft: 114, startTop: 30, driftX: 8,  driftY: -18, delay: 750  }, // small, right
  { size: 16, startLeft: 76, startTop: 62, driftX: 4,   driftY: -12, delay: 1100 }, // tiny, bottom-center
];

export default function SparkleAnimation() {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      {SPARKLE_CONFIG.map((cfg, i) => (
        <SingleSparkle key={i} {...cfg} tintColor={colors.primary} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 160,
    height: 90,
    position: 'relative',
  },
  sparkle: {
    position: 'absolute',
    resizeMode: 'contain',
  },
});
