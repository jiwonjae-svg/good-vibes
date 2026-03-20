import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { FontSize, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { useUserStore } from '../stores/useUserStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export default function StreakFreezeGrantModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const streakFreezeCount = useUserStore((s) => s.streakFreezeCount);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 12 });
      opacity.value = withSpring(1);
    } else {
      scale.value = withSpring(0);
      opacity.value = withSpring(0);
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { backgroundColor: colors.surface }, animatedStyle]}>
          <Text style={styles.emoji}>❄️</Text>
          <Text style={[styles.title, { color: '#64b5f6' }]}>{t('freeze.grantedTitle')}</Text>
          <Text style={[styles.desc, { color: colors.textPrimary }]}>{t('freeze.grantedDesc')}</Text>
          <Text style={[styles.count, { color: '#64b5f6' }]}>
            {t('settings.streakFreezeCount', { count: streakFreezeCount })}
          </Text>
          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>{t('freeze.grantedBtn')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  card: { width: width * 0.82, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
  emoji: { fontSize: 56, marginBottom: Spacing.md },
  title: { ...Fonts.heading, fontSize: FontSize.xl, textAlign: 'center', marginBottom: Spacing.sm },
  desc: { ...Fonts.body, fontSize: FontSize.md, textAlign: 'center', lineHeight: 26, marginBottom: Spacing.md },
  count: { ...Fonts.heading, fontSize: FontSize.lg, marginBottom: Spacing.xl },
  button: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm + 4, borderRadius: BorderRadius.full, backgroundColor: '#64b5f6' },
  buttonText: { ...Fonts.heading, fontSize: FontSize.md, color: '#fff' },
});
