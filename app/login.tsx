import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../hooks/useThemeColors';
import { FontSize, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { useUserStore } from '../stores/useUserStore';
import { signInWithGoogleNative } from '../services/authService';
import SparkleAnimation from '../components/SparkleAnimation';

export default function LoginScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setAuth = useUserStore((s) => s.setAuth);
  const setAuthCompleted = useUserStore((s) => s.setAuthCompleted);
  const hasSeenOnboarding = useUserStore((s) => s.hasSeenOnboarding);
  const isDarkMode = useUserStore((s) => s.isDarkMode);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const user = await signInWithGoogleNative();
      if (user) {
        await setAuth({
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        });
        await setAuthCompleted();
        if (hasSeenOnboarding) {
          router.replace('/(tabs)');
        }
      } else {
        // user cancelled — no error message needed
      }
    } catch {
      setErrorMsg(t('login.signInFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    await setAuthCompleted();
    if (hasSeenOnboarding) {
      router.replace('/(tabs)');
    }
  };

  const s = makeStyles(colors);

  return (
    <LinearGradient
      colors={[colors.background, colors.primary + '22', colors.surfaceAlt]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={s.container}
    >
      {/* Header: logo + sparkle */}
      <View style={[s.header, { paddingTop: insets.top + Spacing.xxl + Spacing.lg }]}>
        <View style={s.sparkleWrapper}>
          <SparkleAnimation />
        </View>
        <Text style={s.appName}>DailyGlow</Text>
        <Text style={s.tagline}>{t('login.tagline')}</Text>
      </View>

      {/* Auth actions */}
      <View style={[s.actions, { paddingBottom: insets.bottom + Spacing.xxl }]}>
        {errorMsg && (
          <Text style={[s.errorText, { color: colors.error }]}>{errorMsg}</Text>
        )}

        <Pressable
          style={[
            s.googleBtn,
            {
              backgroundColor: isDarkMode ? colors.surfaceAlt : '#fff',
              borderColor: isDarkMode ? colors.grass0 : '#dadce0',
            },
          ]}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#EA4335" />
          ) : (
            <>
              <Ionicons name="logo-google" size={22} color="#EA4335" />
              <Text style={[s.googleBtnText, { color: colors.textPrimary }]}>
                {t('login.signInWithGoogle')}
              </Text>
            </>
          )}
        </Pressable>

        <Pressable style={s.skipBtn} onPress={handleSkip} disabled={loading}>
          <Text style={[s.skipText, { color: colors.textMuted }]}>
            {t('login.continueWithoutAccount')}
          </Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: 'space-between' },
    header: { alignItems: 'center', paddingHorizontal: Spacing.lg },
    sparkleWrapper: { marginBottom: Spacing.md },
    appName: {
      ...Fonts.heading,
      fontSize: FontSize.hero,
      color: colors.primary,
      marginBottom: Spacing.sm,
    },
    tagline: {
      ...Fonts.body,
      fontSize: FontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    actions: { paddingHorizontal: Spacing.lg, alignItems: 'center' },
    errorText: {
      ...Fonts.body,
      fontSize: FontSize.sm,
      marginBottom: Spacing.md,
      textAlign: 'center',
    },
    googleBtn: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md + 2,
      borderRadius: BorderRadius.md,
      borderWidth: 1.5,
      marginBottom: Spacing.sm,
    },
    googleBtnText: { ...Fonts.body, fontSize: FontSize.md },
    skipBtn: { padding: Spacing.md, marginTop: Spacing.xs },
    skipText: { ...Fonts.body, fontSize: FontSize.sm },
  });
}

