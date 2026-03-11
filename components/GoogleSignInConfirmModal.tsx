import React from 'react';
import {
  Modal, View, Text, Pressable, StyleSheet, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius } from '../constants/theme';

interface Props {
  visible: boolean;
  email: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shows a native-style confirmation sheet before executing Google Sign-In.
 * Mimics the "Sign in with Google" consent screens seen in other apps.
 */
export default function GoogleSignInConfirmModal({ visible, email, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          {/* App icon */}
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '22' }]}>
            <Text style={styles.iconText}>✨</Text>
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('login.confirmTitle')}
          </Text>

          {email && (
            <View style={[styles.accountRow, { backgroundColor: colors.surfaceAlt }]}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{email[0].toUpperCase()}</Text>
              </View>
              <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>
                {email}
              </Text>
            </View>
          )}

          <Text style={[styles.desc, { color: colors.textSecondary }]}>
            {t('login.confirmDesc')}
          </Text>

          <View style={styles.buttons}>
            <Pressable
              style={[styles.btn, styles.btnCancel, { borderColor: colors.textMuted }]}
              onPress={onCancel}
            >
              <Text style={[styles.btnText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnConfirm, { backgroundColor: colors.primary }]}
              onPress={onConfirm}
            >
              <Text style={[styles.btnText, { color: '#fff' }]}>{t('login.confirmAgree')}</Text>
            </Pressable>
          </View>
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
    paddingHorizontal: Spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconText: { fontSize: 32 },
  title: {
    ...Fonts.heading,
    fontSize: FontSize.lg,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
    maxWidth: '100%',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { ...Fonts.body, fontSize: FontSize.sm, color: '#fff' },
  email: { ...Fonts.body, fontSize: FontSize.sm, flex: 1 },
  desc: {
    ...Fonts.body,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  btnCancel: { borderWidth: 1.5 },
  btnConfirm: {},
  btnText: { ...Fonts.body, fontSize: FontSize.md },
});
