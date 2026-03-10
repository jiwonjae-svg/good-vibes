import React, { useState, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useThemeColors } from '../hooks/useThemeColors';
import { FontSize, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { useUserStore } from '../stores/useUserStore';
import { signInWithGoogleNative } from '../services/authService';
import { appLog } from '../services/logger';
import SparkleAnimation from '../components/SparkleAnimation';
import GoogleSignInConfirmModal from '../components/GoogleSignInConfirmModal';
import ProfileSetupModal from '../components/ProfileSetupModal';

export default function LoginScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setAuth = useUserStore((s) => s.setAuth);
  const setAuthCompleted = useUserStore((s) => s.setAuthCompleted);
  const setProfile = useUserStore((s) => s.setProfile);
  const hasSeenOnboarding = useUserStore((s) => s.hasSeenOnboarding);
  const isDarkMode = useUserStore((s) => s.isDarkMode);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Confirmation modal (shown before triggering Google sign-in)
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [knownEmail, setKnownEmail] = useState<string | null>(null);
  // Profile setup modal (for new users)
  const [profileVisible, setProfileVisible] = useState(false);
  const [pendingUser, setPendingUser] = useState<{ uid: string; displayName: string | null; email: string | null; photoURL: string | null } | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  // Pre-fill the confirm modal with the last-used Google account if available
  useEffect(() => {
    try {
      const current = GoogleSignin.getCurrentUser();
      if (current?.user?.email) setKnownEmail(current.user.email);
    } catch { /* no cached account */ }
  }, []);

  const handleGoogleButtonPress = () => {
    setErrorMsg(null);
    setConfirmVisible(true);
  };

  const handleConfirmAgree = async () => {
    setConfirmVisible(false);
    setLoading(true);
    appLog.log('[login] Google sign-in confirmed');
    try {
      const user = await signInWithGoogleNative();
      if (user) {
        appLog.log('[login] signInWithGoogleNative returned user', { uid: user.uid });
        await setAuth({
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        });

        // Check if new user (no username in Firestore yet)
        const currentUsername = useUserStore.getState().username;
        if (!currentUsername) {
          // New user — show profile setup
          setPendingUser({ uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL });
          setIsNewUser(true);
          setProfileVisible(true);
        } else {
          await setAuthCompleted();
          appLog.log('[login] existing user, navigating');
          if (hasSeenOnboarding) router.replace('/(tabs)');
        }
      } else {
        appLog.log('[login] signInWithGoogleNative returned null (user cancelled)');
      }
    } catch (err: any) {
      appLog.error('[login] signInWithGoogleNative threw', {
        code: err?.code,
        message: err?.message,
      });
      setErrorMsg(t('login.signInFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleProfileComplete = async (displayName: string, username: string) => {
    await setProfile(displayName, username);
    await setAuthCompleted();
    setProfileVisible(false);
    appLog.log('[login] profile saved, navigating');
    if (hasSeenOnboarding) router.replace('/(tabs)');
  };

  const handleProfileSkip = async () => {
    await setAuthCompleted();
    setProfileVisible(false);
    if (hasSeenOnboarding) router.replace('/(tabs)');
  };

  const handleSkip = async () => {
    await setAuthCompleted();
    if (hasSeenOnboarding) {
      router.replace('/(tabs)');
    }
  };

  const s = makeStyles(colors);

  return (
    <>
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
            onPress={handleGoogleButtonPress}
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

      {/* Google sign-in confirmation modal */}
      <GoogleSignInConfirmModal
        visible={confirmVisible}
        email={knownEmail}
        onConfirm={handleConfirmAgree}
        onCancel={() => setConfirmVisible(false)}
      />

      {/* Profile setup modal for new users */}
      <ProfileSetupModal
        visible={profileVisible}
        initialDisplayName={pendingUser?.displayName}
        onComplete={handleProfileComplete}
        onSkip={handleProfileSkip}
      />
    </>
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

