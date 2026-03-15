import React, { useEffect, useRef, useMemo } from 'react';
import {
  Modal, View, Text, Pressable, StyleSheet, Animated, Image,
  Dimensions, Easing,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius } from '../constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const BADGE_META: Record<string, {
  titleKey: string;
  descKey: string;
  image: ReturnType<typeof require>;
}> = {
  streak_3:    { titleKey: 'badge.streak3Title',    descKey: 'badge.streak3Desc',    image: require('../assets/badge_streak_3.png') },
  streak_7:    { titleKey: 'badge.streak7Title',    descKey: 'badge.streak7Desc',    image: require('../assets/badge_streak_7.png') },
  streak_30:   { titleKey: 'badge.streak30Title',   descKey: 'badge.streak30Desc',   image: require('../assets/badge_streak_30.png') },
  streak_100:  { titleKey: 'badge.streak100Title',  descKey: 'badge.streak100Desc',  image: require('../assets/badge_streak_100.png') },
  streak_365:  { titleKey: 'badge.streak365Title',  descKey: 'badge.streak365Desc',  image: require('../assets/badge_streak_365.png') },
  quotes_50:   { titleKey: 'badge.quotes50Title',   descKey: 'badge.quotes50Desc',   image: require('../assets/badge_quotes_50.png') },
  quotes_200:  { titleKey: 'badge.quotes200Title',  descKey: 'badge.quotes200Desc',  image: require('../assets/badge_quotes_200.png') },
  quotes_500:  { titleKey: 'badge.quotes500Title',  descKey: 'badge.quotes500Desc',  image: require('../assets/badge_quotes_500.png') },
  bookmark_5:  { titleKey: 'badge.bookmark5Title',  descKey: 'badge.bookmark5Desc',  image: require('../assets/badge_bookmark_5.png') },
  bookmark_20: { titleKey: 'badge.bookmark20Title', descKey: 'badge.bookmark20Desc', image: require('../assets/badge_bookmark_20.png') },
  community_1: { titleKey: 'badge.community1Title', descKey: 'badge.community1Desc', image: require('../assets/badge_community_1.png') },
  community_5: { titleKey: 'badge.community5Title', descKey: 'badge.community5Desc', image: require('../assets/badge_community_5.png') },
  first_login:  { titleKey: 'badge.firstLoginTitle',  descKey: 'badge.firstLoginDesc',  image: require('../assets/badge_first_login.png') },
  early_bird:   { titleKey: 'badge.earlyBirdTitle',   descKey: 'badge.earlyBirdDesc',   image: require('../assets/badge_early_bird.png') },
  night_owl:    { titleKey: 'badge.nightOwlTitle',    descKey: 'badge.nightOwlDesc',    image: require('../assets/badge_night_owl.png') },
  sharer:       { titleKey: 'badge.sharerTitle',      descKey: 'badge.sharerDesc',      image: require('../assets/badge_sharer.png') },
  multilingual: { titleKey: 'badge.multilingualTitle',descKey: 'badge.multilingualDesc',image: require('../assets/badge_multilingual.png') },
  week_perfect: { titleKey: 'badge.weekPerfectTitle', descKey: 'badge.weekPerfectDesc', image: require('../assets/badge_week_perfect.png') },
};

// Confetti particle colors — warm festive palette
const CONFETTI_COLORS = ['#FF4A2A', '#FF9F7E', '#FFD166', '#06D6A0', '#118AB2', '#F7B2BD', '#CBDFBD'];
const PARTICLE_COUNT = 60;

interface ParticleConfig {
  x: number;
  delay: number;
  color: string;
  size: number;
  rotation: number;
  driftX: number;
  speed: number;
  isSquare: boolean;
}

// Build stable particle config once per mount
function makeParticles(): ParticleConfig[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    x: Math.random() * SCREEN_W,
    delay: Math.random() * 600,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 6 + Math.random() * 8,
    rotation: Math.random() * 360,
    driftX: (Math.random() - 0.5) * 160,
    speed: 1400 + Math.random() * 800,
    isSquare: Math.random() > 0.45,
  }));
}

function ConfettiParticle({ cfg, playing }: { cfg: ParticleConfig; playing: boolean }) {
  const translateY = useRef(new Animated.Value(-20)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(cfg.rotation)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!playing) {
      translateY.setValue(-20);
      translateX.setValue(0);
      rotate.setValue(cfg.rotation);
      opacity.setValue(0);
      return;
    }

    const anim = Animated.sequence([
      Animated.delay(cfg.delay),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_H * 0.85,
          duration: cfg.speed,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: cfg.driftX,
          duration: cfg.speed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: cfg.rotation + 720 + Math.random() * 360,
          duration: cfg.speed,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.delay(cfg.speed - 400),
          Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
        ]),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [playing]);

  const rotateStr = rotate.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: cfg.x,
        width: cfg.size,
        height: cfg.size,
        borderRadius: cfg.isSquare ? 2 : cfg.size / 2,
        backgroundColor: cfg.color,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate: rotateStr }],
      }}
    />
  );
}

interface Props {
  badgeId: string | null;
  onClose: () => void;
}

export default function MilestoneBadgeModal({ badgeId, onClose }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const badgeShineAnim = useRef(new Animated.Value(0)).current;
  const [playing, setPlaying] = React.useState(false);

  const particles = useMemo(makeParticles, []);

  useEffect(() => {
    if (badgeId) {
      setPlaying(true);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 60,
          friction: 6,
        }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(badgeShineAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.back(1.5)),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      setPlaying(false);
      scaleAnim.setValue(0.4);
      opacityAnim.setValue(0);
      badgeShineAnim.setValue(0);
    }
  }, [badgeId]);

  if (!badgeId) return null;
  const meta = BADGE_META[badgeId];
  if (!meta) return null;

  const badgeScale = badgeShineAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <Modal visible={!!badgeId} transparent animationType="none" onRequestClose={onClose}>
      {/* Full-screen confetti layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particles.map((cfg, i) => (
          <ConfettiParticle key={i} cfg={cfg} playing={playing} />
        ))}
      </View>

      {/* Backdrop + card */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <Text style={styles.label}>{t('badge.newBadge')}</Text>

          <Animated.View style={[styles.badgeWrapper, { transform: [{ scale: badgeScale }] }]}>
            <Image source={meta.image} style={styles.badgeImage} resizeMode="contain" />
          </Animated.View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>{t(meta.titleKey)}</Text>
          <Text style={[styles.desc, { color: colors.textSecondary }]}>{t(meta.descKey)}</Text>

          <Pressable style={[styles.button, { backgroundColor: colors.primary }]} onPress={onClose}>
            <Text style={styles.buttonText}>{t('common.ok')}</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#FFD166',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badgeWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,159,126,0.12)',
    marginVertical: Spacing.sm,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: 'rgba(255,74,42,0.35)',
  },
  badgeImage: {
    width: 140,
    height: 140,
    transform: [{ scale: 1.4 }],
  },
  title: { ...Fonts.heading, fontSize: FontSize.lg, textAlign: 'center' },
  desc: { ...Fonts.body, fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 },
  button: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.full,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
});

