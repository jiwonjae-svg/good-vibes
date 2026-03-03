import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';
import { MotiView, MotiImage } from 'moti';
import { LightColors } from '../constants/theme';

const { width, height } = Dimensions.get('window');
const SPLASH_IMG = require('../assets/splash-scene.png');

const BASE_BG = LightColors.background;
const BRIGHTER_BG = '#FFFBF5';
const WARMER_BG = '#FFF5EB';

interface AnimatedSplashProps {
  onAnimationComplete: () => void;
}

export default function AnimatedSplash({ onAnimationComplete }: AnimatedSplashProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase(1), 300);
    const timer2 = setTimeout(() => setPhase(2), 2000);
    const timer3 = setTimeout(() => onAnimationComplete(), 2800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onAnimationComplete]);

  return (
    <MotiView
      style={styles.container}
      from={{ backgroundColor: BASE_BG }}
      animate={{
        backgroundColor: phase >= 1 ? [BASE_BG, BRIGHTER_BG, WARMER_BG, BASE_BG] : BASE_BG,
      }}
      transition={{
        type: 'timing',
        duration: 2500,
        loop: false,
      }}
    >
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 500 }}
        style={styles.backgroundGlow}
      >
        {[...Array(3)].map((_, i) => (
          <MotiView
            key={i}
            from={{ scale: 0.8, opacity: 0 }}
            animate={{
              scale: phase >= 1 ? [1, 1.2, 1] : 0.8,
              opacity: phase >= 1 ? [0.2, 0.35, 0.2] : 0,
            }}
            transition={{
              type: 'timing',
              duration: 2000,
              delay: i * 300,
              loop: true,
            }}
            style={[
              styles.glowCircle,
              {
                width: 200 + i * 80,
                height: 200 + i * 80,
                borderRadius: 100 + i * 40,
                backgroundColor: i === 0 ? LightColors.primary : i === 1 ? LightColors.secondary : LightColors.accent,
              },
            ]}
          />
        ))}
      </MotiView>

      <MotiImage
        source={SPLASH_IMG}
        from={{
          opacity: 0,
          scale: 0.3,
          rotate: '-15deg',
        }}
        animate={{
          opacity: phase >= 1 ? 1 : 0,
          scale: phase >= 1 ? 1 : 0.3,
          rotate: phase >= 1 ? '0deg' : '-15deg',
        }}
        transition={{
          type: 'spring',
          damping: 15,
          stiffness: 100,
        }}
        style={styles.logo}
        resizeMode="contain"
      />

      <View style={styles.particleContainer}>
        {[...Array(8)].map((_, i) => (
          <MotiView
            key={`particle-${i}`}
            from={{
              opacity: 0,
              translateY: 0,
              translateX: 0,
              scale: 0,
            }}
            animate={{
              opacity: phase >= 1 ? [0, 0.8, 0] : 0,
              translateY: phase >= 1 ? [-20, -100 - Math.random() * 50] : 0,
              translateX: phase >= 1 ? [(i % 2 === 0 ? -1 : 1) * (20 + Math.random() * 30)] : 0,
              scale: phase >= 1 ? [0, 1, 0.5] : 0,
            }}
            transition={{
              type: 'timing',
              duration: 1500 + Math.random() * 1000,
              delay: i * 150,
              loop: phase < 2,
            }}
            style={[
              styles.particle,
              {
                left: width * 0.3 + (i * width * 0.05),
                top: height * 0.5,
                backgroundColor: i % 3 === 0 ? LightColors.primary : i % 3 === 1 ? LightColors.secondary : LightColors.accent,
              },
            ]}
          />
        ))}
      </View>

    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundGlow: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCircle: {
    position: 'absolute',
    opacity: 0.3,
  },
  logo: {
    width: width * 0.5,
    height: width * 0.5,
    zIndex: 10,
  },
  particleContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
