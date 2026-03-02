import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';
import { MotiView, MotiImage } from 'moti';
import { LightColors } from '../constants/theme';

const { width, height } = Dimensions.get('window');
const SPLASH_IMG = require('../assets/splash-scene.png');

interface AnimatedSplashProps {
  onAnimationComplete: () => void;
}

export default function AnimatedSplash({ onAnimationComplete }: AnimatedSplashProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase(1), 300);
    const timer2 = setTimeout(() => setPhase(2), 1200);
    const timer3 = setTimeout(() => setPhase(3), 2000);
    const timer4 = setTimeout(() => onAnimationComplete(), 2800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onAnimationComplete]);

  return (
    <View style={styles.container}>
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
              opacity: phase >= 1 ? [0.3, 0.5, 0.3] : 0,
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
          scale: phase >= 3 ? 1.5 : phase >= 1 ? 1 : 0.3,
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

      <MotiView
        from={{ opacity: 0, translateY: 30 }}
        animate={{
          opacity: phase >= 2 ? 1 : 0,
          translateY: phase >= 2 ? 0 : 30,
        }}
        transition={{ type: 'timing', duration: 600 }}
        style={styles.titleContainer}
      >
        <MotiView
          from={{ width: 0 }}
          animate={{ width: phase >= 2 ? 120 : 0 }}
          transition={{ type: 'timing', duration: 800, delay: 200 }}
          style={styles.titleLine}
        />
      </MotiView>

      {phase >= 3 && (
        <MotiView
          from={{ opacity: 1, scale: 1 }}
          animate={{ opacity: 0, scale: 1.5 }}
          transition={{ type: 'timing', duration: 600 }}
          style={StyleSheet.absoluteFill}
        >
          <View style={[styles.fadeOut, { backgroundColor: LightColors.background }]} />
        </MotiView>
      )}

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
              loop: phase < 3,
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LightColors.background,
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
  titleContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  titleLine: {
    height: 3,
    backgroundColor: LightColors.primary,
    borderRadius: 2,
  },
  fadeOut: {
    flex: 1,
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
