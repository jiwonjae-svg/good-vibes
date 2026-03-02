import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius } from '../constants/theme';

interface PremiumPromptModalProps {
  visible: boolean;
  onClose: () => void;
  featureName?: string;
}

export default function PremiumPromptModal({ visible, onClose, featureName }: PremiumPromptModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accent + '30' }]}>
            <Ionicons name="diamond" size={40} color={colors.accent} />
          </View>
          
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('premium.requiredTitle')}
          </Text>
          
          <Text style={[styles.desc, { color: colors.textSecondary }]}>
            {featureName ? t('premium.featureDesc', { feature: featureName }) : t('premium.generalDesc')}
          </Text>
          
          <Pressable style={[styles.btn, { backgroundColor: colors.primary }]} onPress={onClose}>
            <Text style={styles.btnText}>{t('common.ok')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Fonts.heading,
    fontSize: FontSize.lg,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  desc: {
    ...Fonts.body,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  btn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  btnText: {
    ...Fonts.heading,
    fontSize: FontSize.md,
    color: '#fff',
  },
});
