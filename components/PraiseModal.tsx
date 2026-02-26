import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { FontSize, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { useTTS } from '../hooks/useTTS';

interface PraiseModalProps {
  visible: boolean;
  praise: string;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export default function PraiseModal({ visible, praise, onClose }: PraiseModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const { speak } = useTTS({ rate: 0.85 });

  useEffect(() => {
    if (visible && praise) {
      scale.value = withSpring(1, { damping: 12 });
      opacity.value = withSpring(1);
      speak(praise);
    } else {
      scale.value = withSpring(0);
      opacity.value = withSpring(0);
    }
  }, [visible, praise]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { backgroundColor: colors.surface }, animatedStyle]}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={[styles.title, { color: colors.primary }]}>{t('praise.title')}</Text>
          <Text style={[styles.praise, { color: colors.textPrimary }]}>{praise}</Text>
          <Pressable style={[styles.button, { backgroundColor: colors.primary }]} onPress={onClose}>
            <Text style={styles.buttonText}>{t('praise.continue')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  card: { width: width * 0.8, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
  emoji: { fontSize: 48, marginBottom: Spacing.md },
  title: { ...Fonts.heading, fontSize: FontSize.xl, marginBottom: Spacing.sm },
  praise: { ...Fonts.body, fontSize: FontSize.md, textAlign: 'center', lineHeight: 26, marginBottom: Spacing.lg },
  button: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm + 4, borderRadius: BorderRadius.full },
  buttonText: { ...Fonts.heading, fontSize: FontSize.md, color: '#fff' },
});
