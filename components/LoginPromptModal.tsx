import React from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { signInWithGoogleNative } from '../services/authService';
import { useUserStore } from '../stores/useUserStore';

interface LoginPromptModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export default function LoginPromptModal({
  visible,
  onClose,
  title,
  description,
}: LoginPromptModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const setAuth = useUserStore((s) => s.setAuth);
  const setAuthCompleted = useUserStore((s) => s.setAuthCompleted);
  const setPendingNewUserSignIn = useUserStore((s) => s.setPendingNewUserSignIn);
  const isDarkMode = useUserStore((s) => s.isDarkMode);

  const handleGoogleLogin = async () => {
    try {
      const user = await signInWithGoogleNative();
      if (user) {
        await setAuth({ uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL });
        const currentUsername = useUserStore.getState().username;
        if (!currentUsername) {
          // New user — trigger global onboarding modals in _layout.tsx
          setPendingNewUserSignIn({ uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL });
        } else {
          await setAuthCompleted();
        }
        onClose();
      }
    } catch {
      // sign-in failed — modal stays open so user can retry
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconWrapper, { backgroundColor: colors.primaryLight + '30' }]}>
            <Ionicons name="sparkles" size={32} color={colors.primary} />
          </View>
          
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {title || t('guest.loginPromptTitle')}
          </Text>
          <Text style={[styles.desc, { color: colors.textSecondary }]}>
            {description || t('guest.loginPromptDesc')}
          </Text>

          <Pressable
            style={[
              styles.googleBtn,
              {
                borderColor: isDarkMode ? colors.grass0 : '#dadce0',
                backgroundColor: isDarkMode ? colors.surfaceAlt : '#fff',
              },
            ]}
            onPress={handleGoogleLogin}
          >
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text style={[styles.btnText, { color: colors.textPrimary }]}>{t('settings.loginWithGoogle')}</Text>
          </Pressable>

          <Pressable style={styles.laterBtn} onPress={onClose}>
            <Text style={[styles.laterText, { color: colors.textMuted }]}>{t('guest.laterAction')}</Text>
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
  sheet: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.floating,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Fonts.heading,
    fontSize: FontSize.lg,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  desc: {
    ...Fonts.body,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    width: '100%',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
  },
  btnText: {
    ...Fonts.body,
    fontSize: FontSize.md,
  },
  laterBtn: {
    padding: Spacing.sm,
  },
  laterText: {
    ...Fonts.body,
    fontSize: FontSize.sm,
  },
});
