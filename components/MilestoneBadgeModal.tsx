import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius } from '../constants/theme';

const BADGE_META: Record<string, { emoji: string; titleKey: string; descKey: string }> = {
  streak_7: { emoji: '🔥', titleKey: 'badge.streak7Title', descKey: 'badge.streak7Desc' },
  streak_30: { emoji: '⭐', titleKey: 'badge.streak30Title', descKey: 'badge.streak30Desc' },
  streak_100: { emoji: '👑', titleKey: 'badge.streak100Title', descKey: 'badge.streak100Desc' },
  streak_365: { emoji: '🏆', titleKey: 'badge.streak365Title', descKey: 'badge.streak365Desc' },
};

interface Props {
  badgeId: string | null;
  onClose: () => void;
}

export default function MilestoneBadgeModal({ badgeId, onClose }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (badgeId) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 7 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.5);
      opacityAnim.setValue(0);
    }
  }, [badgeId]);

  if (!badgeId) return null;
  const meta = BADGE_META[badgeId];
  if (!meta) return null;

  return (
    <Modal visible={!!badgeId} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.surface, transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          <Text style={styles.label}>{t('badge.newBadge')}</Text>
          <Text style={styles.emoji}>{meta.emoji}</Text>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
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
  emoji: { fontSize: 64, lineHeight: 80 },
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
